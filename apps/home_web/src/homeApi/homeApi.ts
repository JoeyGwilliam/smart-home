/** One of the home's APIs could not be reached, or failed to handle a request. Trying again later may work. */
export class ApiUnavailableError extends Error {}

/**
 * One of the home's APIs understood a request and refused it: either what it was sent breaks its rules, or what was
 * asked isn't allowed at the moment. Sending the same request again would be refused again. The message is the API's
 * own reason when it gives one in words, which are meant for the person.
 */
export class RequestRefusedError extends Error {}

/**
 * What happened to a change that was sent to one of the home's APIs.
 *
 * - `saved`: the API holds the change.
 * - `invalid`: the API refused the change, so the person needs to fix it.
 * - `unavailable`: the API couldn't be reached, so the person can try again later.
 */
export type SaveOutcome = 'saved' | 'invalid' | 'unavailable'

/**
 * Sends a request to one of the home's APIs, all of which fail in the same ways.
 *
 * @param apiName What to call the API in error messages, such as "reminders".
 * @param method The HTTP method, such as "GET".
 * @param url The address, such as "/api/reminders". nginx.conf and vite.config.ts forward it to the API.
 * @param body Sent as JSON. Left out to send no body.
 * @returns The API's response, which is always a success.
 * @throws ApiUnavailableError If the API can't be reached, or fails.
 * @throws RequestRefusedError If the API refuses the request.
 */
export async function sendToHomeApi(apiName: string, method: string, url: string, body?: object): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    // fetch only throws when the request never got a response. Callers can't recover from that any differently from a
    // server failure, so both become the one error they document.
    throw new ApiUnavailableError(`The ${apiName} API could not be reached.`, { cause: error })
  }

  // nginx answers 502 or 504 when the API isn't running, which is the same situation as the API failing.
  if (response.status >= 500) {
    throw new ApiUnavailableError(`The ${apiName} API failed with status ${response.status}.`)
  }
  // The APIs answer 422 to content that breaks their rules, and 409 to an action that isn't allowed at the moment.
  if (response.status === 409 || response.status === 422) {
    throw new RequestRefusedError(await readRefusalReason(response, `The ${apiName} API refused ${method} ${url}.`))
  }
  if (!response.ok) {
    // Any other status means this client sent a request the API doesn't understand, which is a bug, not a condition.
    throw new Error(`The ${apiName} API unexpectedly answered ${method} ${url} with status ${response.status}.`)
  }
  return response
}

/**
 * Waits for a change that was sent to one of the home's APIs, and reports what happened to it rather than throwing.
 * Callers show the outcome to the person, so the expected failures become outcomes rather than errors that every
 * caller would need to catch.
 *
 * @param change The change, which is a call to a function that uses `sendToHomeApi`.
 * @returns The outcome.
 * @throws Anything that the change throws other than the two errors above, which is a bug, so it is left to crash.
 */
export async function reportOutcome(change: Promise<unknown>): Promise<SaveOutcome> {
  try {
    await change
    return 'saved'
  } catch (error) {
    if (error instanceof RequestRefusedError) return 'invalid'
    if (error instanceof ApiUnavailableError) return 'unavailable'
    throw error
  }
}

async function readRefusalReason(response: Response, fallbackReason: string): Promise<string> {
  try {
    const { detail } = await response.json()
    // The APIs give their reason as text when a person can act on it, and as a list of faults in the content otherwise.
    return typeof detail === 'string' ? detail : fallbackReason
  } catch {
    // A refusal without a readable body is still a refusal, so only the reason is lost.
    return fallbackReason
  }
}
