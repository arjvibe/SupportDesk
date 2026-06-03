import { useMutation } from "@tanstack/react-query";
import { ticketsApi } from "../api/ticketsApi";

export function useUploadAttachment() {
  return useMutation({
    mutationFn: (file: File) => ticketsApi.uploadAttachment(file),
  });
}
