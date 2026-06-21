import { setupServer } from 'msw/node'

/** 테스트별로 server.use(...)로 핸들러를 추가한다. */
export const server = setupServer()
