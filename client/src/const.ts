/** Start the HEMIP OTP sign-in flow on the application's own origin. */
export function startLogin(): void {
  window.location.assign("/auth");
}
