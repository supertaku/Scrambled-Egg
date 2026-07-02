package com.tupt.haki

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeferredTerminalDispatcherTest {
  @Test
  fun settlesBeforeDeferredCleanupRuns() {
    val events = mutableListOf<String>()
    val queued = mutableListOf<() -> Unit>()
    val dispatcher = DeferredTerminalDispatcher { cleanup -> queued.add(cleanup) }

    assertTrue(dispatcher.dispatch(
      settle = { events.add("settled") },
      cleanup = { events.add("cleaned") }
    ))

    assertEquals(listOf("settled"), events)
    assertEquals(1, queued.size)

    queued.single().invoke()

    assertEquals(listOf("settled", "cleaned"), events)
  }

  @Test
  fun dispatchesOnlyOnce() {
    val queued = mutableListOf<() -> Unit>()
    var settlements = 0
    val dispatcher = DeferredTerminalDispatcher { cleanup -> queued.add(cleanup) }

    assertTrue(dispatcher.dispatch(settle = { settlements += 1 }, cleanup = {}))
    assertFalse(dispatcher.dispatch(settle = { settlements += 1 }, cleanup = {}))

    assertEquals(1, settlements)
    assertEquals(1, queued.size)
  }

  @Test
  fun cleanupFailureDoesNotEscapeTheQueuedTask() {
    val queued = mutableListOf<() -> Unit>()
    val dispatcher = DeferredTerminalDispatcher { cleanup -> queued.add(cleanup) }

    assertTrue(dispatcher.dispatch(
      settle = {},
      cleanup = { throw AssertionError("cleanup failed") }
    ))

    queued.single().invoke()
  }

  @Test
  fun cleanupQueueFailureDoesNotEscapeDispatch() {
    val dispatcher = DeferredTerminalDispatcher(
      enqueueCleanup = { throw AssertionError("queue unavailable") }
    )

    assertTrue(dispatcher.dispatch(settle = {}, cleanup = {}))
  }
}
