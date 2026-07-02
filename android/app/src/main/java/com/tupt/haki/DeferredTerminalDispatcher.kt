package com.tupt.haki

import java.util.concurrent.atomic.AtomicBoolean

internal class DeferredTerminalDispatcher(
  private val onSettlementFailure: (Throwable) -> Unit = {},
  private val onCleanupFailure: (Throwable) -> Unit = {},
  private val enqueueCleanup: (() -> Unit) -> Unit
) {
  private val dispatched = AtomicBoolean(false)

  fun dispatch(settle: () -> Unit, cleanup: () -> Unit): Boolean {
    if (!dispatched.compareAndSet(false, true)) return false

    try {
      settle()
    } catch (error: Throwable) {
      onSettlementFailure(error)
    } finally {
      try {
        enqueueCleanup {
          try {
            cleanup()
          } catch (error: Throwable) {
            onCleanupFailure(error)
          }
        }
      } catch (error: Throwable) {
        onCleanupFailure(error)
      }
    }
    return true
  }
}
