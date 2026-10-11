"use client"

// The Merchants page (DESIGN.md, page type "List"): add a shop, rename it, retire it.
// "Add merchant" is the toolbar's primary action and opens a sheet, rename reuses it,
// and every merchant is one flat row in a single card. Only rows the signed-in user may
// actually change are listed, so a normal user sees their own merchants and an admin
// also sees the published ones. The shipped catalog stays selectable either way and is
// only counted in the card's footer.

import { useMemo, useState } from "react"
import { IconDots, IconPlus } from "@tabler/icons-react"

import { Field } from "@/components/app/field"
import { FormSheet, type FormSheetResult } from "@/components/app/form-sheet"
import { listCardClass } from "@/components/app/grouped"
import { PageHeader } from "@/components/app/page-header"
import { SearchInput } from "@/components/app/search-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

import { MerchantTile } from "./merchant-tile"
import type { Merchant } from "./merchants"

export type MerchantDirectoryCopy = {
  merchants: string
  merchantName: string
  addMerchant: string
  renameMerchant: string
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
  merchantSearch: string
  actions: string
  emptyMerchants: string
}

/** What the sheet edits: a new merchant, or the name of an existing one. */
type Target = { kind: "new" } | { kind: "rename"; merchant: Merchant }

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
  /** Saves a merchant; a failure comes back for the sheet to show. */
  save: (name: string, options?: { id?: string; archived?: boolean; global?: boolean }) => Promise<FormSheetResult>
}) {
  const [target, setTarget] = useState<Target | null>(null)
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

  return (
    <div className="space-y-4">
      <PageHeader title={copy.merchants} primaryAction={{ label: copy.addMerchant, icon: <IconPlus />, onClick: () => setTarget({ kind: "new" }), disabled: busy }} />
      <section className={listCardClass}>
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2 max-lg:min-h-12">
          <h2 className="text-headline">{copy.merchants}</h2>
          {editable.length > 8 ? (
            <SearchInput className="w-full sm:w-56" aria-label={copy.merchantSearch} placeholder={copy.merchantSearch} value={search} onChange={(event) => setSearch(event.target.value)} />
          ) : null}
        </div>
        <ul className="hairline-rows border-t border-separator">
          {shown.length === 0 ? <li className="px-4 py-3 text-footnote text-label-secondary">{copy.emptyMerchants}</li> : null}
          {shown.map((merchant) => (
            <li key={merchant.id} className={cn("flex min-h-9 items-center gap-3 px-4 py-1 max-lg:min-h-12 max-lg:py-2", merchant.archived && "text-label-secondary")}>
              <MerchantTile merchant={merchant} size={28} />
              <span className="min-w-0 flex-1 truncate">{merchant.name}</span>
              {merchant.catalog ? <Badge tone="blue">{copy.published}</Badge> : null}
              {merchant.archived ? <Badge>{copy.archived}</Badge> : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" disabled={busy} aria-label={`${copy.actions}: ${merchant.name}`} title={copy.actions}>
                    <IconDots />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setTarget({ kind: "rename", merchant })}>{copy.rename}</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void save(merchant.name, { id: merchant.id, archived: !merchant.archived })}>
                    {merchant.archived ? copy.restore : copy.archive}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
        <p className="border-t border-separator bg-fill px-4 py-2 text-footnote text-label-secondary">
          {copy.merchantsNote} {catalogCount} {copy.catalogCount}
        </p>
      </section>
      {target ? (
        <MerchantSheet
          key={target.kind === "rename" ? target.merchant.id : "new"}
          target={target}
          copy={copy}
          isAdmin={isAdmin}
          close={() => setTarget(null)}
          save={save}
        />
      ) : null}
    </div>
  )
}

/** The name form in a sheet; admins may publish a new merchant to everyone. */
function MerchantSheet({ target, copy, isAdmin, close, save }: {
  target: Target
  copy: MerchantDirectoryCopy
  isAdmin: boolean
  close: () => void
  save: (name: string, options?: { id?: string; archived?: boolean; global?: boolean }) => Promise<FormSheetResult>
}) {
  const [name, setName] = useState(target.kind === "rename" ? target.merchant.name : "")
  const [publish, setPublish] = useState(false)
  return (
    <FormSheet
      open
      title={target.kind === "rename" ? copy.renameMerchant : copy.addMerchant}
      description={copy.merchantsNote}
      submitLabel={target.kind === "rename" ? copy.rename : copy.addMerchant}
      cancelLabel={copy.cancel}
      submitDisabled={!name.trim()}
      submit={() => save(name.trim(), target.kind === "rename"
        ? { id: target.merchant.id, archived: target.merchant.archived }
        : { global: isAdmin && publish })}
      close={close}
    >
      <Field label={copy.merchantName}>
        <Input autoComplete="off" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      {isAdmin && target.kind === "new" ? (
        <div className="flex items-center gap-2">
          <Checkbox id="merchant-publish" checked={publish} onCheckedChange={(checked) => setPublish(checked === true)} />
          <Label htmlFor="merchant-publish" className="text-callout font-normal">{copy.publishMerchant}</Label>
        </div>
      ) : null}
    </FormSheet>
  )
}
