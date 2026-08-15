# Mobile Chrome zero-data incident

## Observed production state

- The authenticated desktop browser session displays non-zero financial data for the affected Hisba account on the production dashboard.
- The affected mobile Chrome session still displays zeros for that same account.
- This confirms the issue is in the mobile browser's authenticated-read or hydration path, not an intentional empty financial profile.

## Debugging direction

- Do not render a zero financial snapshot until the mobile session identity is verified and the first remote read has completed successfully.
- Record and surface remote-read failures rather than treating them as an empty result.
- Preserve offline data and the sync queue; never overwrite a populated cache with an unverified empty response.

## Production inspection status

- The production SQL editor is accessible for read-only verification of persisted account and transaction records.
- No financial data was changed during this inspection.
- The dashboard SQL editor rejected the aggregate diagnostic with an editor validation error before returning results; it must not be treated as evidence that the tables are empty.

## Updated production finding

- The authenticated reference browser had remained on the dashboard loading skeleton instead of completing its financial read.
- The loading path was updated to bound every Supabase request to eight seconds, retain cache/error semantics, and show the dashboard retry state instead of an indefinite skeleton after ten seconds.
- The dashboard now coalesces concurrent table reads, performs queue delivery in the background, and reuses already-loaded monthly transactions when calculating the budget. This removes overlapping transaction/account hydrations from the first render.
- The production dashboard was rechecked after deployment at `https://hisbba.web.app/dashboard`: the authenticated account rendered its non-zero balance (`E£ 965.00`), monthly income (`E£ 15,000.00`), monthly expenses (`E£ 14,035.00`), recent transactions, and account balance without remaining on the loading skeleton.
- A physical Chrome-on-mobile check is still required to confirm the affected mobile session receives the same production result after closing and reopening the tab.
