"""JWT helpers for negative auth tests (same-length invalid signature)."""


def invalid_token_same_length(valid_token: str) -> str:
    """Build a malformed JWT that keeps signature length to avoid backend crash."""
    parts = valid_token.split(".")
    if len(parts) != 3:
        return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4In0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    header, payload, sig = parts
    bad_sig = ("A" if sig[:1] != "A" else "B") + sig[1:]
    return f"{header}.{payload}.{bad_sig}"
