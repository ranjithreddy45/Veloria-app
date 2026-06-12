import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { getAcqContract } from "@/actions/acq-contract.actions";
import { ContractDetail, type ContractFull } from "./_components/contract-detail";

export const metadata: Metadata = { title: "Contract" };

export default async function BdContractDetailPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  const [res, session] = await Promise.all([getAcqContract(contractId), auth()]);
  if (!res.success) notFound();
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  return <ContractDetail contract={res.data as ContractFull} userRole={userRole} />;
}
