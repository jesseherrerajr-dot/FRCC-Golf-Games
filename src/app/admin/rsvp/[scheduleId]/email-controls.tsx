"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { ConfirmModal } from "@/components/confirm-modal";
import {
  sendInviteNow,
  sendReminderNow,
  sendGolferConfirmationNow,
  sendProShopDetailNow,
} from "./email-actions";

type EmailStatus = {
  inviteSent: boolean;
  reminderSent: boolean;
  golferConfirmationSent: boolean;
  proShopSent: boolean;
};

type EmailControlsProps = {
  scheduleId: string;
  status: EmailStatus;
  confirmedCount: number;
  pendingCount: number;
  totalSubscribers: number;
};

type EmailType = "invite" | "reminder" | "golfer_confirmation" | "pro_shop";

const emailLabels: Record<EmailType, string> = {
  invite: "Invite",
  reminder: "Reminder",
  golfer_confirmation: "Golfer Confirmation",
  pro_shop: "Pro Shop Detail",
};

const emailDescriptions: Record<EmailType, (props: EmailControlsProps) => string> = {
  invite: (p) => `Send invite emails to all ${p.totalSubscribers} subscribers?`,
  reminder: (p) => `Send reminder to ${p.pendingCount} golfer(s) who haven't responded?`,
  golfer_confirmation: (p) => `Send confirmation email to ${p.confirmedCount} confirmed golfer(s)?`,
  pro_shop: (p) => `Send pro shop detail email with player info and GHIN numbers?`,
};

export function EmailStatusPanel(props: EmailControlsProps) {
  const { scheduleId, status, confirmedCount, pendingCount, totalSubscribers } = props;

  const emails: { type: EmailType; sent: boolean }[] = [
    { type: "invite", sent: status.inviteSent },
    { type: "reminder", sent: status.reminderSent },
    { type: "golfer_confirmation", sent: status.golferConfirmationSent },
    { type: "pro_shop", sent: status.proShopSent },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="divide-y divide-gray-200">
        {emails.map(({ type, sent }) => (
          <EmailRow
            key={type}
            type={type}
            sent={sent}
            scheduleId={scheduleId}
            controlsProps={props}
          />
        ))}
      </div>
    </div>
  );
}

function EmailRow({
  type,
  sent,
  scheduleId,
  controlsProps,
}: {
  type: EmailType;
  sent: boolean;
  scheduleId: string;
  controlsProps: EmailControlsProps;
}) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const { showToast } = useToast();

  const label = emailLabels[type];
  const isResend = sent;

  const handleSend = () => {
    setShowConfirm(false);
    startTransition(async () => {
      let result: { success?: boolean; sent?: number; error?: string };

      switch (type) {
        case "invite":
          result = await sendInviteNow(scheduleId);
          break;
        case "reminder":
          result = await sendReminderNow(scheduleId);
          break;
        case "golfer_confirmation":
          result = await sendGolferConfirmationNow(scheduleId);
          break;
        case "pro_shop":
          result = await sendProShopDetailNow(scheduleId);
          break;
      }

      if (result.error) {
        showToast(result.error, "error");
      } else {
        showToast(
          `${label} email sent to ${result.sent} recipient(s)`
        );
      }
    });
  };

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {sent ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-teal-600">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
              </svg>
            </span>
          )}
          <span className={`text-sm font-medium ${sent ? "text-gray-700" : "text-gray-900"}`}>
            {label}
          </span>
          {sent && (
            <span className="text-xs text-teal-600">Sent</span>
          )}
        </div>

        <button
          onClick={() => setShowConfirm(true)}
          disabled={isPending}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
            isResend
              ? "border border-gray-300 text-gray-600 hover:bg-gray-100"
              : "bg-navy-900 text-white hover:bg-navy-800"
          }`}
        >
          {isPending ? "Sending…" : isResend ? "Resend" : "Send Now"}
        </button>
      </div>

      <ConfirmModal
        open={showConfirm}
        title={`${isResend ? "Resend" : "Send"} ${label} Email`}
        message={
          isResend
            ? `This email was already sent. Are you sure you want to resend the ${label.toLowerCase()} email? Recipients will receive a duplicate.`
            : emailDescriptions[type](controlsProps)
        }
        confirmLabel={isResend ? "Resend" : "Send Now"}
        variant={isResend ? "danger" : "default"}
        loading={isPending}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleSend}
      />
    </>
  );
}
