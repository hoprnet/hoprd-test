import http, { RefinedParams, RefinedResponse, ResponseType } from 'k6/http'
import { check } from 'k6'
import { Counter } from 'k6/metrics'

/**
 * Wrap Message API
 */
export class MesssagesApi{

  private url: string
  private httpParams: RefinedParams<ResponseType>

  public constructor(url: string, httpParams: RefinedParams<ResponseType>) {
    this.url = url
    this.httpParams = httpParams
  }

  /**
   * Invoke API Rest call for sending a message
   */
  public sendMessage(requestPayload: string, successCounter: Counter, failedCounter: Counter): boolean {
    // console.log(`Sending message ${JSON.stringify(messageRequest)}`)
    const messageResponse: RefinedResponse<'text'> = http.post(
      `${this.url}/messages`, requestPayload,     
      this.httpParams
    )

    if (check(messageResponse, { 'Message sent': () => messageResponse.status === 202 })) {
      successCounter.add(1)
      return true
    } else {
      console.error(`Failed to send message. Details: ${JSON.stringify(messageResponse)}`)
      failedCounter.add(1,{ request: requestPayload, response: JSON.stringify(messageResponse) });
      return false
    }
  }
}
