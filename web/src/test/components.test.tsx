import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { validateSkinForm } from "../admin/pages/Skins";
import { ErrorState } from "../components/ErrorState";
import { RarityBadge, SkinCard } from "../components/Skin";
import { Toggle } from "../components/ui";
import { ApiError } from "../lib/api";
import { translate } from "../lib/i18n";
import type { InventoryItem, Skin } from "../lib/types";
import { filterAndSort } from "../pages/Inventory";
import { useSettings } from "../store/settings";

const skin = (over: Partial<Skin> = {}): Skin => ({
  id: 1,
  slug: "x",
  name: "Carbon Pulse",
  weaponName: "Kestrel P2",
  weaponType: "pistol",
  rarity: "rare",
  image: "/a.svg",
  thumbnail: "/a.svg",
  description: "",
  virtualPrice: 160,
  collectionId: 1,
  collection: "Origin",
  active: true,
  featured: false,
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

const item = (id: number, s: Partial<Skin>, updatedAt: string): InventoryItem => ({ id, quantity: 1, favorite: false, acquiredAt: updatedAt, updatedAt, skin: skin({ id, ...s }) });

describe("SkinCard", () => {
  it("renders weapon, skin name, rarity, value and quantity; handles taps", () => {
    useSettings.setState({ language: "en" });
    const onClick = vi.fn();
    render(<SkinCard skin={skin()} quantity={3} onClick={onClick} />);
    expect(screen.getByText("Kestrel P2")).toBeInTheDocument();
    expect(screen.getByText("Carbon Pulse")).toBeInTheDocument();
    expect(screen.getByText("Rare")).toBeInTheDocument();
    expect(screen.getByText("×3")).toBeInTheDocument();
    expect(screen.getByText("160")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Carbon Pulse/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("shows a lock for unowned collection items", () => {
    const { container } = render(<SkinCard skin={skin()} locked />);
    expect(container.querySelector("button")?.className).toContain("opacity-55");
  });
});

describe("RarityBadge", () => {
  it("translates rarity labels", () => {
    useSettings.setState({ language: "uz" });
    render(<RarityBadge rarity="legendary" />);
    expect(screen.getByText("Afsonaviy")).toBeInTheDocument();
    useSettings.setState({ language: "en" });
  });
});

describe("ErrorState", () => {
  it("shows a friendly message per error code with a retry action", () => {
    const retry = vi.fn();
    render(
      <MemoryRouter>
        <ErrorState error={new ApiError("INSUFFICIENT_COINS", "x", 402)} onRetry={retry} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Not enough coins");
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(retry).toHaveBeenCalled();
  });

  it("falls back to a generic server error", () => {
    render(<ErrorState error={new Error("boom")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });
});

describe("Toggle", () => {
  it("is an accessible switch", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Sound" />);
    const sw = screen.getByRole("switch", { name: /Sound/ });
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("inventory filtering and sorting", () => {
  const items = [
    item(1, { name: "Alpha", rarity: "common", virtualPrice: 10, weaponType: "rifle", collection: "A" }, "2026-01-01T00:00:00Z"),
    item(2, { name: "Beta", rarity: "legendary", virtualPrice: 5000, weaponType: "knife", collection: "B" }, "2026-01-03T00:00:00Z"),
    item(3, { name: "Gamma", rarity: "epic", virtualPrice: 900, weaponType: "rifle", collection: "A" }, "2026-01-02T00:00:00Z"),
  ];
  const base = { search: "", rarity: "all", weapon: "all", collection: "all", sort: "newest" as const };

  it("sorts by newest, rarity and value", () => {
    expect(filterAndSort(items, base).map((i) => i.id)).toEqual([2, 3, 1]);
    expect(filterAndSort(items, { ...base, sort: "rarity" }).map((i) => i.id)).toEqual([2, 3, 1]);
    expect(filterAndSort(items, { ...base, sort: "value" }).map((i) => i.skin.virtualPrice)).toEqual([5000, 900, 10]);
  });

  it("filters by search, rarity, weapon and collection", () => {
    expect(filterAndSort(items, { ...base, search: "gam" }).map((i) => i.id)).toEqual([3]);
    expect(filterAndSort(items, { ...base, rarity: "common" }).map((i) => i.id)).toEqual([1]);
    expect(filterAndSort(items, { ...base, weapon: "rifle" }).map((i) => i.id)).toEqual([3, 1]);
    expect(filterAndSort(items, { ...base, collection: "B" }).map((i) => i.id)).toEqual([2]);
  });
});

describe("admin skin form validation", () => {
  const ok = { name: "Carbon Pulse", weaponType: "rifle", weaponName: "", rarity: "rare" as const, virtualPrice: "1000", description: "", collectionId: "", newCollection: "", active: true, featured: false, uploadId: "abc", preview: null };
  it("accepts a valid form", () => {
    expect(Object.values(validateSkinForm(ok, true)).filter(Boolean)).toHaveLength(0);
  });
  it("flags missing image, bad price and missing fields", () => {
    const e = validateSkinForm({ ...ok, name: "", weaponType: "", rarity: "", virtualPrice: "-3", uploadId: null }, true);
    expect(Object.keys(e)).toEqual(expect.arrayContaining(["name", "weaponType", "rarity", "virtualPrice", "image"]));
    expect(validateSkinForm({ ...ok, virtualPrice: "2000000" }, true).virtualPrice).toMatch(/Maksimal/);
    expect(validateSkinForm({ ...ok, virtualPrice: "1.5" }, true).virtualPrice).toBeTruthy();
    expect(validateSkinForm({ ...ok, uploadId: null }, false).image).toBeUndefined();
  });
});

describe("i18n", () => {
  it("interpolates and falls back to English", () => {
    expect(translate("ru", "cases.openFor", { cost: 250 })).toBe("Открыть за 250");
    expect(translate("uz", "daily.claim", { amount: 250 })).toBe("250 olish");
  });
});
