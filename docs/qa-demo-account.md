# Disposable verified QA account (development only)

Normal signup/login still require email verification. There is no HTTP bypass,
feature flag in the app, startup hook, migration, or production auth change.
This standalone helper inserts a **new** verified Casey Demo account, using a
random `qa-demo-<uuid>@example.invalid` identity. It never upgrades an existing
user, grants admin access, or changes plan/credit defaults. No verification mail
is sent. Use only demo content.

## Safety / opt-in

- Disabled unless `NODE_ENV` is exactly `development`, `REPLIT_DEV_DOMAIN` is
  present, `REPLIT_DEPLOYMENT` is absent/empty, and `--confirm-development` is passed.
- Guards run before the database module is loaded. Every deployed marker value
  (even `"0"`) is rejected. The helper is not imported by the app or production build.
- Uses the existing workspace database binding. **Never override `DATABASE_URL`
  or point the workspace at a production database.** Environment checks cannot
  make an intentionally substituted production connection safe.
- No persistent environment/secrets or publishing settings need to change.
- Password goes through stdin, not argv, command history, output, or a saved
  script. It is stored only as the app's normal salted scrypt hash.

## Use from a QA runner (preferred)

1. Generate a strong random password in runner memory (24–128 characters,
   uppercase, lowercase, digit, symbol).
2. Spawn `npx tsx scripts/qa-demo-user.ts create --confirm-development`, passing
   a child-process environment copied from the workspace with
   `NODE_ENV: "development"`. Pass the password via stdin. Do not log stdin.
3. Parse stdout JSON `{id, email}`. Keep the password in memory and log in at
   `/login` using this email/password against **local preview**, not the published
   app. This is a normal Explorer account, not an authenticated-session shortcut.
4. After QA, run the revoke command below. Discard the in-memory password and
   browser session. Never save browser storage state or credentials to disk.

For manual QA, a hidden prompt avoids command-history exposure:

```sh
python3 - <<'PY'
import getpass, os, subprocess
password = getpass.getpass("Strong random QA-only password (24+ chars): ")
subprocess.run(
    ["npx", "tsx", "scripts/qa-demo-user.ts", "create", "--confirm-development"],
    input=password, text=True, check=True,
    env={**os.environ, "NODE_ENV": "development"},
)
del password
PY
```

## Undo / revoke

Use the `id` returned by create (not an email or real user's ID):

```sh
NODE_ENV=development npx tsx scripts/qa-demo-user.ts revoke qa-demo-<uuid> --confirm-development
```

This transaction un-verifies only the matching synthetic Casey Demo account,
replaces its password with an unknown random hash, clears reset/verification
tokens, and deletes its existing
Passport sessions. Demo trees/memories are retained, not silently deleted. Clean
up unwanted demo content via the UI before revoking. To test again, create a new
account. Never import these accounts into production.

Revocation deliberately keeps a hash: the existing login flow interprets a null
hash as a legacy account needing a password-setup email. An unknown random hash
blocks the old password without triggering that flow.

## Tests

`npm run test:qa-demo-user` checks opt-in/default/production/deployment rejection,
synthetic account scoping, normal password hashing, and credential/session
revocation. No database or credential values are printed.