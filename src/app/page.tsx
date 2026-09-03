import { redirect } from "next/navigation";

/** This whole app is the staff/admin surface — "/" has nothing of its own to show. */
export default function RootPage() {
  redirect("/staff");
}
