export function ensureAuthState(req, _, next) {
    if (!req.session.auth0State) {
        return next(new Error("Invalid session"));
    }
    next()
}
