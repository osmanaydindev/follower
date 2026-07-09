// Command server runs the Follower HTTP API.
//
// Provider is chosen via IG_PROVIDER (default: mock). Port via PORT (default 8080).
package main

import (
	"log"
	"net/http"
	"os"

	"follower/backend/internal/api"
	"follower/backend/internal/instagram"
)

func main() {
	ig := instagram.NewFromEnv()
	srv := api.NewServer(ig)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port

	provider := "mock"
	if os.Getenv("IG_PROVIDER") == "real" {
		provider = "real"
	}
	log.Printf("Follower API listening on %s (instagram provider: %s)", addr, provider)

	if err := http.ListenAndServe(addr, srv.Handler()); err != nil {
		log.Fatal(err)
	}
}
