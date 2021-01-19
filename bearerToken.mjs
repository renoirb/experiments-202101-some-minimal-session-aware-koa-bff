export const bearerToken = (token) => {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid bearer token')
  }
  const decoded = []
  for (const part of parts) {
    try {
      const asBuffer = Buffer.from(part, 'base64')
      const asString = asBuffer.toString('ascii')
      const maybe = JSON.parse(asString)
      decoded.push(maybe)
    } catch (e) {
      // console.log(e)
    }
  }
  return decoded
}
