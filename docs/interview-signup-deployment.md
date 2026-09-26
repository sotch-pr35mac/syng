# Interview signup: manual deployment review

## Status and boundaries

These changes are source code and infrastructure-as-code only. No AWS resources,
LocalStack stacks, website deployments, app releases, credentials, or live signup
records are created or changed as part of implementation. Do not run deployment
commands until a maintainer has reviewed and approved the release separately.

The backend changes live in the `pw/interview-signups` branch of the separate
`syrver-interviews` worktree, based on Syrver `master`. Do not switch or modify the
other agent's Syrver checkout. The website changes are in `syng-landing`.

## Review before release

1. Review and integrate the Syrver, Syng, and landing-site changes together. Resolve
   any conflicts with concurrent backend work before deployment. Syrver's existing
   disabled remote-deployment Makefile targets remain disabled.
2. Review the new Lambda and route (`POST /v1/interview-signups`), stage-specific
   DynamoDB table (`syrver-interview-signups-<stage>`), TTL on `expires_at_epoch`,
   encryption, dedicated Lambda role, and API Gateway throttle. The Lambda role has
   GetItem/PutItem/UpdateItem access only to its signup table, with logging/tracing
   permissions; existing telemetry roles receive no access to the contact table.
3. Manually grant only the maintainer's operator identity the console permissions
   needed to inspect, scan, and delete signup records. Do not grant public access,
   add contact fields to telemetry, or enable request/response-body logging.
4. Review the versioned consent text in `src/views/templates/utils/interviews.ts`
   (`interviews-v1`) and the revised website privacy policy. A substantive change
   to the consent copy needs a new version supported by both app and endpoint.
   Confirm the support mailbox is monitored and the manual withdrawal procedure is
   owned. Review applicable app-store privacy disclosures for email, preferred name,
   identifier, and linked usage data before distributing the feature.
5. Before outreach, confirm applicable interview/guardian consent requirements.
   Existing regional child-mode eligibility is a product rule, not verification of
   age, identity, email ownership, or consent to interview/record someone.

## Deferred deployment and integration verification

After separate manual approval, deploy backend infrastructure/code and publish the
privacy policy before releasing the client. Package the new Lambda with Syrver's
existing packaging script. Use the reviewed release process; this feature does not
enable or change deployment automation. No data migration or new secret is needed.

The AWS/LocalStack integration smoke test is deliberately deferred. Use an isolated
test stack and fake `example.invalid` contacts, never the other agent's stack or
real volunteers. Verify:

- A consented POST creates one signup record and returns HTTP 200 only after storage.
- An identical retry returns 200 without changing its consent time or 365-day expiry.
- A changed payload with the same UUID returns 409 without overwriting the original.
- Invalid/missing consent returns 400; oversized bodies return 413; the sixth request
  in a per-IP hourly bucket returns 429. Rate counters have a two-hour TTL and no raw IP.
- The stored device ID matches the app's telemetry envelopes; telemetry-disabled
  signup does not enable telemetry or register a telemetry token.
- TTL is enabled, IAM permissions are constrained, and contact details appear in
  neither telemetry nor application logs. Check error counts and throttling using
  existing API Gateway/Lambda monitoring without logging payloads.
- A network failure leaves Retry/Skip usable, and both fresh and version-1 installs
  work on desktop/mobile. Child-mode installs never show a signup form.

Only after these checks should the app be released. If backend availability fails,
users can skip; no contact details are queued for background delivery. If rollback
is needed, stop distributing the feature client first and review backend removal
manually. Do not delete the contact table as a routine rollback; continue honoring
existing withdrawal requests and expiry. Review backup/export retention if any are
introduced later; none are added by this change.

## AWS console workflow (after deployment)

Open DynamoDB in the deployed region (`us-west-2` for production), select
`syrver-interview-signups-production`, and use **Explore table items → Scan**.
Apply `record_type = signup` and numeric `expires_at_epoch > current Unix time`
filters. Finish all result pages: a scan filter applies per page. DynamoDB TTL can
take a few days to remove expired items; never contact expired signups even if the
console still displays their records. Each signup includes its preferred name,
email, `device_id`, consent version/time, and expiry. Names and addresses are
unverified; use the device ID only to review usage for interview recruitment and
preparation, not to authenticate anyone. Do not create permanent exported copies.

For withdrawal, have the person contact `hello@bytecraft.xyz` from the signup
address. Filter `email_lookup` by the trimmed, lowercase address, omit the expiry
filter, and scan every page. Delete **every matching SIGNUP record** so registrations
from multiple devices or sessions are covered. Correcting an email requires
checking the new address with the requester before editing it; update both `email`
and lowercase `email_lookup` without renewing the original consent/expiry. A name
correction updates only `preferred_name`. Record handling in the support thread,
without copying telemetry histories or identifiers into it unnecessarily.

For a combined signup-and-telemetry deletion request, locate and handle associated
telemetry using the stored device IDs before removing signup links. A signup-only
withdrawal removes the contact/link records; separately collected telemetry keeps
its existing retention/deletion policy. Stop outreach on receipt of withdrawal and
remove any temporary outreach copies. Support correspondence follows its separate
published retention policy. Consent for an interview and any recording is obtained
separately during scheduling. This release sends no automatic emails.
