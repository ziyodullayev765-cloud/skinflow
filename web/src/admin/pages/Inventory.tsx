import { useEffect, useState } from "react";
import { Notice, PageHeader } from "../components/kit";
import { DataTable } from "../components/DataTable";
import { UserDetail } from "../components/UserDetail";
import { userColumns, useUserList } from "./Users";

/** Search a user, then inspect their virtual coins, skins, openings and missions. */
export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => setPage(1), [search]);
  const q = useUserList(search, page);
  return (
    <>
      <PageHeader title="Inventar" subtitle="Istalgan o'yinchining virtual tangalari, skinlari, ochilishlar tarixi va vazifalarini ko'ring." />
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <DataTable
          columns={userColumns.slice(0, 3)}
          rows={q.data?.rows}
          loading={q.isLoading}
          rowKey={(u) => u.id}
          onRowClick={(u) => setSelected(u.id)}
          search={{ value: search, onChange: setSearch, placeholder: "Foydalanuvchini toping…" }}
          page={page}
          total={q.data?.total}
          onPage={setPage}
        />
        <div className="card p-5">
          {selected ? <UserDetail key={selected} userId={selected} canEdit={false} /> : <Notice>Inventarini ko'rish uchun foydalanuvchini tanlang.</Notice>}
        </div>
      </div>
    </>
  );
}
