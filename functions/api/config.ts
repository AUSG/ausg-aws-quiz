import { API_HEADERS } from '../../worker/http'
import { getBoothSettings } from '../../worker/booth-settings'

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    return Response.json(await getBoothSettings(env.DB), { headers: API_HEADERS })
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'booth settings request failed',
        error: error instanceof Error ? error.message : String(error),
        path: new URL(request.url).pathname,
      }),
    )
    return Response.json(
      { error: '퀴즈 설정을 불러오지 못했어요.' },
      { status: 500, headers: API_HEADERS },
    )
  }
}
