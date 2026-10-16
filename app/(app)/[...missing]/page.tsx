import { notFound } from "next/navigation";

// Any unknown address inside the app shows the 404 page with the sidebar.
export default function Missing() {
  notFound();
}
