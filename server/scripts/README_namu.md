# NamuWiki import notes

The automated fetcher keeps the source URL list in `scripts/namu_sources.json`, but
NamuWiki may return a browser challenge instead of raw wiki text.

Current fallback workflow:

Option A: browser bookmarklet

1. Open `scripts/namu_bookmarklet.html` in a browser.
2. Drag `Namu source to .code` to the bookmarks bar.
3. Open a NamuWiki edit/source page.
4. Click the bookmarklet.
5. Move the downloaded `.code` file into `scripts/namu_pastes`.

Option B: clipboard helper

1. Open the page in a normal browser.
2. Copy the wiki text/source for the page.
3. Save it from the clipboard:

```powershell
npm.cmd run save:namu -- --slug subjects
```

Known slugs are listed in `scripts/namu_sources.json`: `guide`,
`lumia_island`, `subjects`, `weapon_skills`, `tactical_skills`, `traits`.

You can also save manually as `.code` or `.txt` under `scripts/namu_pastes`.
Optionally add metadata header lines at the top:

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

One-shot clipboard save and import:

```powershell
npm.cmd run save:namu -- --slug subjects --import
```

The importer writes derived facts to MongoDB and does not store full page text in
`ErMeta.raw`.
