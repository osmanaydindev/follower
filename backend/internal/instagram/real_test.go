package instagram

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// A throttle must reach the app as 429 with Instagram's own explanation, not as
// a generic 502 — the client stops retrying only if it can tell the difference.
func TestSidecarStatusIsCarried(t *testing.T) {
	cases := []struct {
		name       string
		sidecar    int
		detail     string
		fallback   int
		wantStatus int
	}{
		{"throttle", http.StatusTooManyRequests, "birkac dakika bekle", http.StatusBadGateway, http.StatusTooManyRequests},
		{"dead session", http.StatusUnauthorized, "oturum suresi doldu", http.StatusBadGateway, http.StatusUnauthorized},
		{"sidecar fault", http.StatusInternalServerError, "bozuldu", http.StatusBadGateway, http.StatusBadGateway},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tc.sidecar)
				_, _ = w.Write([]byte(`{"detail":"` + tc.detail + `"}`))
			}))
			defer srv.Close()

			_, err := NewReal(srv.URL).Followers(context.Background(), &Session{Auth: "{}"})
			if err == nil {
				t.Fatal("expected an error")
			}
			if err.Error() != tc.detail {
				t.Errorf("message = %q, want the sidecar's %q", err.Error(), tc.detail)
			}
			if got := StatusFor(err, tc.fallback); got != tc.wantStatus {
				t.Errorf("StatusFor = %d, want %d", got, tc.wantStatus)
			}
		})
	}
}
