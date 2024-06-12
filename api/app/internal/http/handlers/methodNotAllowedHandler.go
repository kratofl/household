package handlers

import "net/http"

func MethodNotAllowedHandler(w http.ResponseWriter, r *http.Request) {
	Write(w, http.StatusMethodNotAllowed)
}
