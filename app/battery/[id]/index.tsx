import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";

export default function BatteryIndex() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  useEffect(() => {
    router.replace(`/battery/${encodeURIComponent(String(id ?? "default"))}/picker` as any);
  }, [id]);

  return null;
}
