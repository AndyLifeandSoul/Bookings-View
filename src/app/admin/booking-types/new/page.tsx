import { ActionForm } from "@/components/action-form";
import { BookingTypeFields } from "../booking-type-fields";
import { createBookingType } from "../actions";

export default function NewBookingTypePage() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-zinc-900">New booking type</h2>
      <ActionForm action={createBookingType}>
        <BookingTypeFields submitLabel="Create booking type" />
      </ActionForm>
    </div>
  );
}
