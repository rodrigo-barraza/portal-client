import type { Metadata } from "next";
import StorageComponent from "@/components/StorageComponent";

export const metadata: Metadata = {
  title: "Object Store — Portal",
};

export default function ObjectStorePage() {
  return <StorageComponent />;
}
