# NamuWiki import notes

The automated fetcher keeps the source URL list in `scripts/namu_sources.json`, but
NamuWiki may return a browser challenge instead of raw wiki text.

Current fallback workflow:

1. Open the page in a normal browser.
2. Copy the wiki text/source for the page.
3. Save it as `.code` or `.txt` under `scripts/namu_pastes`.
4. Optionally add metadata header lines at the top:

```text
# @namu-source kind=weaponSkill
# @namu-source slug=weapon_skills
# @namu-source title=이터널 리턴/무기 스킬
# @namu-source url=https://namu.wiki/w/...
```

Supported `kind` values:

- `guide`
- `map`
- `subjectIndex`
- `weaponSkill`
- `tacticalSkill`
- `trait`
- `item`

Useful commands:

```powershell
npm.cmd run parse:namu
npm.cmd run parse:namu:subjects
npm.cmd run parse:namu:meta
npm.cmd run import:namu:all
```

The importer writes derived facts to MongoDB and does not store full page text in
`ErMeta.raw`.
