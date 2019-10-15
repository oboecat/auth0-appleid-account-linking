You need to set up both Rules in the Auth0 dashboard. You'll need to configure 3 Parameters for this to work:

1. NAMESPACE - Url for namespace
2. APPLE_LINK_CLIENT_ID - Client ID of the Linker App
3. APPLE_LINK_APP_URI - Path of the Linker App


Example

```bash
NAMESPACE=https://wolfpack.travel0.net/
APPLE_LINK_CLIENT_ID=foo
APPLE_LINK_APP_URI=https://somedomain.example.org/start
```