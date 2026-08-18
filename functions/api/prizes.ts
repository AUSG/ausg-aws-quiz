import { getPrizeCatalog } from '../../worker/prize-store'
import { API_HEADERS } from '../../worker/http'

const RESPONSE_INIT: ResponseInit = {
  headers: API_HEADERS,
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const catalog = await getPrizeCatalog(env.DB)
    return Response.json(catalog, RESPONSE_INIT)
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'inventory request failed',
        error: error instanceof Error ? error.message : String(error),
        path: new URL(request.url).pathname,
      }),
    )
    return Response.json({ error: '재고를 불러오지 못했어요.' }, { status: 500, ...RESPONSE_INIT })
  }
}
