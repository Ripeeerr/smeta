import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Requisition, Status } from "../api/types";
import { statusLabels } from "../lib/format";
import { CreateLink } from "../components/Layout";
import { RequestTable } from "../components/RequestTable";
import { ErrorNotice, Loading } from "../components/UI";

export function Requests({ purchasing = false }: { purchasing?: boolean }) {
  const [params] = useSearchParams();
  const { data, error, isPending } = useQuery({
    queryKey: ["requisitions"],
    queryFn: () => api<Requisition[]>("requisitions/"),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Рабочее пространство</span>
          <h1>{purchasing ? "Закупки" : "Заявки"}</h1>
          <p>
            {purchasing
              ? "Выбор поставщиков, оформление и получение товаров."
              : "От первого запроса до согласованного решения."}
          </p>
        </div>
        <CreateLink />
      </div>
      {isPending ? (
        <Loading />
      ) : error ? (
        <ErrorNotice error={error} />
      ) : (
        <RequestTable
          initialStatus={
            params.get("status") && params.get("status")! in statusLabels
              ? (params.get("status") as Status)
              : "all"
          }
          key={params.toString()}
          requests={data || []}
          initialSearch={params.get("search") || ""}
          purchasing={purchasing}
        />
      )}
    </>
  );
}
