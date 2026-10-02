"use client"

// The merchant directory: add a shop, rename it, retire it. Only rows the signed-in user may
// actually change are listed, so a normal user sees their own merchants and an admin also sees
// the published ones. The shipped catalog stays selectable either way and is only counted.

import { useMemo, useState } from "react"

import { Block, Group } from "@/components/app/grouped"
import { SearchInput } from "@/components/app/search-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

import { MerchantTile } from "./merchant-tile"
import type { Merchant } from "./merchants"

export type MerchantDirectoryCopy = {
  merchants: string
  merchantName: string
  addMerchant: string
  publishMerchant: string
  merchantsNote: string
  /** Follows the count, so it must read as a continuation: "65 merchants ship with…". */
  catalogCount: string
  published: string
  rename: string
  archive: string
  restore: string
  archived: string
  cancel: string
  search: string
  emptyMerchants: string
}

export function MerchantDirectory({
  copy,
  merchants,
  isAdmin,
  busy,
  save,
}: {
  copy: MerchantDirectoryCopy
  merchants: Merchant[]
  isAdmin: boolean
  busy: boolean
  save: (name: string, options?: { id?: string; archived?: boolean; global?: boolean }) => void
}) {
  const [name, setName] = useState("")
  const [editing, setEditing] = useState<Merchant | null>(null)
  const [publish, setPublish] = useState(false)
  const [search, setSearch] = useState("")

  // A published merchant is everyone's, so only an admin gets it in the editable list.
  const editable = useMemo(
    () => merchants.filter((merchant) => (merchant.catalog ? isAdmin : true)),
    [merchants, isAdmin],
  )
  const shown = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    return needle ? editable.filter((merchant) => merchant.name.toLocaleLowerCase().includes(needle)) : editable
  }, [editable, search])
  const catalogCount = merchants.filter((merchant) => merchant.catalog).length

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    save(trimmed, editing ? { id: editing.id, archived: editing.archived } : { global: isAdmin && publish })
    setName("")
    setEditing(null)
    setPublish(false)
  }

  return (
    <Group title={copy.merchants} footer={`${copy.merchantsNote} ${catalogCount} ${copy.catalogCount}`}>
      {editable.length > 8 ? (
        <Block>
          <Label htmlFor="merchant-search" className="sr-only">{copy.search}</Label>
          <SearchInput id="merchant-search" placeholder={copy.search} value={search} onChange={(event) => setSearch(event.target.value)} />
        </Block>
      ) : null}

      {shown.map((merchant) => (
        <div key={merchant.id} className={cn("flex min-h-12 flex-wrap items-center gap-3 px-4 py-2", merchant.archived && "text-label-secondary")}>
          <MerchantTile merchant={merchant} />
          <span className="min-w-0 flex-1 truncate">{merchant.name}</span>
          {merchant.catalog ? <Badge tone="blue">{copy.published}</Badge> : null}
          {merchant.archived ? <Badge>{copy.archived}</Badge> : null}
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setEditing(merchant); setName(merchant.name) }}>
            {copy.rename}
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => save(merchant.name, { id: merchant.id, archived: !merchant.archived })}>
            {merchant.archived ? copy.restore : copy.archive}
          </Button>
        </div>
      ))}
      {shown.length === 0 ? <Block className="text-label-secondary">{copy.emptyMerchants}</Block> : null}

      <Block className="flex flex-wrap items-center gap-2">
        <Label htmlFor="merchant-name" className="sr-only">{copy.merchantName}</Label>
        <Input
          id="merchant-name"
          className="min-w-40 flex-1"
          placeholder={copy.merchantName}
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submit() } }}
        />
        {isAdmin && !editing ? (
          <div className="flex items-center gap-2">
            <Checkbox id="merchant-publish" checked={publish} onCheckedChange={(checked) => setPublish(checked === true)} />
            <Label htmlFor="merchant-publish" className="text-callout font-normal">{copy.publishMerchant}</Label>
          </div>
        ) : null}
        <Button variant="secondary" disabled={busy || !name.trim()} onClick={submit}>
          {editing ? copy.rename : copy.addMerchant}
        </Button>
        {editing ? (
          <Button variant="text" onClick={() => { setName(""); setEditing(null) }}>{copy.cancel}</Button>
        ) : null}
      </Block>
    </Group>
  )
}
