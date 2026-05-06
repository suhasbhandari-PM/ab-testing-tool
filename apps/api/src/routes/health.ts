export function healthRoute(): { statusCode: number; body: unknown } {
  return {
    statusCode: 200,
    body: {
      ok: true,
      service: "ab-testing-api",
      timestamp: new Date().toISOString()
    }
  };
}
