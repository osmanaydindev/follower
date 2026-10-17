package instagram

import (
	"errors"
	"net/http"
)

// UpstreamError is an error the sidecar returned, with the HTTP status it used.
//
// The status matters: a throttle ("please wait a few minutes") and a dead
// session are ordinary, expected conditions the app must react to differently
// from "the sidecar is broken". Collapsing everything into 502 made a throttle
// look like a server fault, so the app kept retrying and dug the hole deeper.
type UpstreamError struct {
	Status int
	Msg    string
}

func (e *UpstreamError) Error() string { return e.Msg }

// StatusFor picks the HTTP status to send to the app for err. Only statuses the
// client acts on are forwarded — 429 (back off and stop retrying) and 401 (the
// Instagram session is dead, log in again). Anything else is a fault on our side
// of the wire and keeps the caller's fallback (normally 502).
func StatusFor(err error, fallback int) int {
	var ue *UpstreamError
	if errors.As(err, &ue) {
		switch ue.Status {
		case http.StatusTooManyRequests, http.StatusUnauthorized:
			return ue.Status
		}
	}
	return fallback
}
