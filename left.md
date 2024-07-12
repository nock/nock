# Blockers (for beta)

## Headers
- folds duplicate headers the same as Node
- when keys are duplicated, is evaluated once per input field name, in correct order

## Recorder
- does not record requests from previous sessions

# Non-Blockers (for beta)

## preemtive timeout
- emits a timeout - with setTimeout
- emits a timeout - with options.timeout
- emits a timeout - with Agent.timeout
- emits a timeout - options.timeout takes precedence over Agent.timeout
- Emits the expected event sequence when aborted after a delay from the `finish` event

## Nock open question/problems
- match hostname as regex and string in tandem

## Misc
- Request with `Expect: 100-continue` triggers continue event (https://github.com/mswjs/interceptors/pull/515#issuecomment-2067760131)

### - get correct filtering with scope and request headers filtering
Why is this the correct behavior?

### - error events on reply streams proxy to the response
What does this mean to emit error after response end? 

### socket.authorized should be false?
- should denote the response client is authorized for HTTPS requests

### - socket has getPeerCertificate() method which returns a random base64 string
`getPeerCertificate` does not return a string

# Unspecified

- should be safe to call in the middle of a request
- socket emits connect and secureConnect - edge case (https://github.com/mswjs/interceptors/pull/515#issuecomment-2067702330)
- error events on reply streams proxy to the response