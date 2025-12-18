import { useEffect, useRef } from 'react'

import { createAdminStream, createPublicStream, type SSEHandler } from '../api/sse'

export const useEventStream = (channel: 'admin' | 'public', handler: SSEHandler | null) => {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!handlerRef.current) {
      return
    }
    const stream =
      channel === 'admin'
        ? createAdminStream((payload) => handlerRef.current?.(payload))
        : createPublicStream((payload) => handlerRef.current?.(payload))

    return () => {
      stream.close()
    }
  }, [channel])
}
