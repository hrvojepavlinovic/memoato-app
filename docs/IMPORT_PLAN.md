# Import plan (JSON export)

When you share the JSON export, the first step will be to freeze an import contract:

- filename(s) + example payload
- top-level shape (array vs object)
- required fields (timestamp, text, tags, etc.)
- field semantics (timezone, locale, units)

## Proposed approach

1. Add a dedicated import endpoint/action (server-only).
2. Persist the raw JSON payload + import metadata (source app, exported_at).
3. Transform rows into `Log` records:
   - map `text` → `rawText`
   - map `timestamp` → `occurredAt` and `occurredOn` (date-only)
   - map any existing categories/tags if present
4. Run the rules-based classifier to fill `{category, item, value}` when possible.
5. Anything ambiguous becomes Uncategorized for manual correction.

## Notes

- LLM-based enrichment/classification remains off until the rules engine + correction loop ships.
