import CryptoKit
import ExpoModulesCore
import Foundation

public class HakiDeviceInfoModule: Module, URLSessionDownloadDelegate {
  private let operationLock = NSLock()
  private var canceledHashOperations = Set<String>()
  private let transferDefaults = UserDefaults(suiteName: "com.tupt.haki.background-downloads")!
  private lazy var backgroundSession: URLSession = {
    let configuration = URLSessionConfiguration.background(withIdentifier: "com.tupt.haki.model-downloads")
    configuration.isDiscretionary = false
    configuration.sessionSendsLaunchEvents = true
    return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
  }()

  public func definition() -> ModuleDefinition {
    Name("HakiDeviceInfo")

    AsyncFunction("getHardwareProfile") { () -> [String: Any] in
      return [
        "supportedAbis": ["arm64"],
        "totalMemoryBytes": Double(ProcessInfo.processInfo.physicalMemory),
        "lowMemory": false,
        "cpuCoreCount": ProcessInfo.processInfo.activeProcessorCount,
        "thermalState": self.thermalStateName(ProcessInfo.processInfo.thermalState)
      ]
    }

    AsyncFunction("sha256File") { (targetUri: String, operationId: String) throws -> String in
      guard let url = URL(string: targetUri), url.isFileURL else {
        throw HakiDeviceInfoError.invalidFileUrl
      }

      let handle = try FileHandle(forReadingFrom: url)
      defer {
        try? handle.close()
        self.clearCancellation(operationId)
      }

      var digest = SHA256()
      while true {
        if self.isCanceled(operationId) {
          throw HakiDeviceInfoError.canceled
        }
        let data = try handle.read(upToCount: 1024 * 1024) ?? Data()
        if data.isEmpty {
          break
        }
        digest.update(data: data)
      }

      return digest.finalize().map { String(format: "%02x", $0) }.joined()
    }

    Function("cancelSha256File") { (operationId: String) in
      self.operationLock.lock()
      self.canceledHashOperations.insert(operationId)
      self.operationLock.unlock()
    }

    AsyncFunction("startBackgroundDownload") { (source: String, operationId: String) throws -> [String: Any] in
      guard let sourceUrl = URL(string: source) else {
        throw HakiDeviceInfoError.invalidDownloadUrl
      }
      let target = try self.downloadTarget(operationId)
      try? FileManager.default.removeItem(at: target)
      let task = self.backgroundSession.downloadTask(with: sourceUrl)
      task.taskDescription = operationId
      self.saveTransfer(
        operationId,
        taskIdentifier: task.taskIdentifier,
        fileUri: target.absoluteString,
        phase: "queued",
        bytesWritten: 0,
        totalBytes: nil,
        error: nil
      )
      task.resume()
      return ["downloadId": task.taskIdentifier, "fileUri": target.absoluteString]
    }

    AsyncFunction("getBackgroundDownloadStatus") { (operationId: String) -> [String: Any] in
      guard let record = self.transferDefaults.dictionary(forKey: self.transferKey(operationId)) else {
        return self.statusPayload(phase: "missing", bytesWritten: 0, totalBytes: nil, error: "Download record is missing.")
      }
      return self.statusPayload(
        phase: record["phase"] as? String ?? "queued",
        bytesWritten: (record["bytesWritten"] as? NSNumber)?.int64Value ?? 0,
        totalBytes: (record["totalBytes"] as? NSNumber)?.int64Value,
        error: record["error"] as? String
      )
    }

    AsyncFunction("cancelBackgroundDownload") { (operationId: String) async in
      let tasks = await self.allBackgroundTasks()
      tasks.first(where: { $0.taskDescription == operationId })?.cancel()
      if let record = self.transferDefaults.dictionary(forKey: self.transferKey(operationId)),
         let fileUri = record["fileUri"] as? String,
         let fileUrl = URL(string: fileUri) {
        try? FileManager.default.removeItem(at: fileUrl)
      }
      self.transferDefaults.removeObject(forKey: self.transferKey(operationId))
    }

    AsyncFunction("clearBackgroundDownloadRecord") { (operationId: String) in
      self.transferDefaults.removeObject(forKey: self.transferKey(operationId))
    }
  }

  public func urlSession(
    _ session: URLSession,
    downloadTask: URLSessionDownloadTask,
    didWriteData bytesWritten: Int64,
    totalBytesWritten: Int64,
    totalBytesExpectedToWrite: Int64
  ) {
    guard let operationId = downloadTask.taskDescription else { return }
    let fileUri = transferDefaults.dictionary(forKey: transferKey(operationId))?["fileUri"] as? String ?? ""
    saveTransfer(
      operationId,
      taskIdentifier: downloadTask.taskIdentifier,
      fileUri: fileUri,
      phase: "downloading",
      bytesWritten: totalBytesWritten,
      totalBytes: totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : nil,
      error: nil
    )
  }

  public func urlSession(
    _ session: URLSession,
    downloadTask: URLSessionDownloadTask,
    didFinishDownloadingTo location: URL
  ) {
    guard let operationId = downloadTask.taskDescription,
          let record = transferDefaults.dictionary(forKey: transferKey(operationId)),
          let fileUri = record["fileUri"] as? String,
          let target = URL(string: fileUri) else { return }
    do {
      try? FileManager.default.removeItem(at: target)
      try FileManager.default.moveItem(at: location, to: target)
      saveTransfer(
        operationId,
        taskIdentifier: downloadTask.taskIdentifier,
        fileUri: fileUri,
        phase: "completed",
        bytesWritten: downloadTask.countOfBytesReceived,
        totalBytes: downloadTask.countOfBytesExpectedToReceive > 0 ? downloadTask.countOfBytesExpectedToReceive : nil,
        error: nil
      )
    } catch {
      saveTransfer(
        operationId,
        taskIdentifier: downloadTask.taskIdentifier,
        fileUri: fileUri,
        phase: "failed",
        bytesWritten: downloadTask.countOfBytesReceived,
        totalBytes: nil,
        error: "Downloaded file could not be staged."
      )
    }
  }

  public func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didCompleteWithError error: Error?
  ) {
    guard let operationId = task.taskDescription,
          let error,
          let record = transferDefaults.dictionary(forKey: transferKey(operationId)) else { return }
    let fileUri = record["fileUri"] as? String ?? ""
    saveTransfer(
      operationId,
      taskIdentifier: task.taskIdentifier,
      fileUri: fileUri,
      phase: "failed",
      bytesWritten: task.countOfBytesReceived,
      totalBytes: task.countOfBytesExpectedToReceive > 0 ? task.countOfBytesExpectedToReceive : nil,
      error: error.localizedDescription
    )
  }

  private func thermalStateName(_ state: ProcessInfo.ThermalState) -> String {
    switch state {
    case .nominal:
      return "nominal"
    case .fair:
      return "fair"
    case .serious:
      return "serious"
    case .critical:
      return "critical"
    @unknown default:
      return "unknown"
    }
  }

  private func isCanceled(_ operationId: String) -> Bool {
    operationLock.lock()
    defer { operationLock.unlock() }
    return canceledHashOperations.contains(operationId)
  }

  private func clearCancellation(_ operationId: String) {
    operationLock.lock()
    canceledHashOperations.remove(operationId)
    operationLock.unlock()
  }

  private func transferKey(_ operationId: String) -> String {
    "transfer.\(operationId)"
  }

  private func downloadTarget(_ operationId: String) throws -> URL {
    let directory = try FileManager.default.url(
      for: .applicationSupportDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    ).appendingPathComponent("haki-downloads", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory.appendingPathComponent("\(operationId).partial.gguf")
  }

  private func saveTransfer(
    _ operationId: String,
    taskIdentifier: Int,
    fileUri: String,
    phase: String,
    bytesWritten: Int64,
    totalBytes: Int64?,
    error: String?
  ) {
    var record: [String: Any] = [
      "taskIdentifier": taskIdentifier,
      "fileUri": fileUri,
      "phase": phase,
      "bytesWritten": bytesWritten
    ]
    if let totalBytes { record["totalBytes"] = totalBytes }
    if let error { record["error"] = error }
    transferDefaults.set(record, forKey: transferKey(operationId))
  }

  private func statusPayload(phase: String, bytesWritten: Int64, totalBytes: Int64?, error: String?) -> [String: Any] {
    [
      "phase": phase,
      "bytesWritten": bytesWritten,
      "totalBytes": totalBytes ?? NSNull(),
      "error": error ?? NSNull()
    ]
  }

  private func allBackgroundTasks() async -> [URLSessionTask] {
    await withCheckedContinuation { continuation in
      backgroundSession.getAllTasks { tasks in
        continuation.resume(returning: tasks)
      }
    }
  }
}

enum HakiDeviceInfoError: Error {
  case canceled
  case invalidDownloadUrl
  case invalidFileUrl
}
