"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/action-form";
import { Input, Select, Textarea } from "@/components/ui";
import {
  AUTOMATION_ACTIONS,
  CONTACT_STATUSES,
  CRM_EVENTS,
  DEAL_STAGES,
  EVENT_LABELS,
  PRIORITIES,
  titleCase,
} from "@/lib/constants";
import type { ActionState } from "@/lib/errors";

const legendClass = "px-1 text-xs font-semibold uppercase tracking-wide text-slate-500";
const fieldsetClass = "space-y-3 rounded-lg border border-slate-200 p-3";

export function RuleForm({ action }: { action: (formData: FormData) => Promise<ActionState> }) {
  const [trigger, setTrigger] = useState<string>("deal.stage_changed");
  const [kind, setKind] = useState<string>("CREATE_TASK");

  const stageOptions = DEAL_STAGES.map((s) => (
    <option key={s.id} value={s.id}>
      {s.label}
    </option>
  ));
  const statusOptions = CONTACT_STATUSES.map((s) => (
    <option key={s} value={s}>
      {titleCase(s)}
    </option>
  ));
  const templateHint = "Placeholders: {{contact.firstName}}, {{deal.title}}, {{deal.value}}";

  return (
    <ActionForm action={action} className="space-y-4">
      <Field label="Name" name="name">
        <Input name="name" required placeholder="e.g. Big deal won → onboarding task" />
      </Field>

      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>When</legend>
        <Field label="Trigger" name="trigger">
          <Select name="trigger" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
            {CRM_EVENTS.map((e) => (
              <option key={e} value={e}>
                When {EVENT_LABELS[e]}
              </option>
            ))}
          </Select>
        </Field>
        {trigger === "deal.stage_changed" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="From stage" name="fromStage">
              <Select name="fromStage" defaultValue="">
                <option value="">Any</option>
                {stageOptions}
              </Select>
            </Field>
            <Field label="To stage" name="toStage">
              <Select name="toStage" defaultValue="WON">
                <option value="">Any</option>
                {stageOptions}
              </Select>
            </Field>
          </div>
        )}
        {trigger.startsWith("deal.") && (
          <Field label="Only if deal value is at least" name="minValue">
            <Input type="number" name="minValue" min={0} step="any" placeholder="Any value" />
          </Field>
        )}
        {trigger.startsWith("contact.") && (
          <Field label="Only if contact status is" name="contactStatus">
            <Select name="contactStatus" defaultValue="">
              <option value="">Any</option>
              {statusOptions}
            </Select>
          </Field>
        )}
      </fieldset>

      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Then</legend>
        <Field label="Action" name="action">
          <Select name="action" value={kind} onChange={(e) => setKind(e.target.value)}>
            {AUTOMATION_ACTIONS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>

        {kind !== "UPDATE_CONTACT_STATUS" && (
          <Field label={kind === "SEND_EMAIL" ? "Email subject" : "Task subject"} name="subject" hint={templateHint}>
            <Input name="subject" placeholder={kind === "SEND_EMAIL" ? "Thanks, {{contact.firstName}}!" : "Kick off {{deal.title}}"} />
          </Field>
        )}
        {kind === "CREATE_TASK" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due in (days)" name="dueInDays">
              <Input type="number" name="dueInDays" min={0} max={365} defaultValue={1} />
            </Field>
            <Field label="Priority" name="priority">
              <Select name="priority" defaultValue="MEDIUM">
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {titleCase(p)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        {kind === "SEND_EMAIL" && (
          <Field label="Send to" name="emailTo">
            <Select name="emailTo" defaultValue="contact">
              <option value="contact">The related contact</option>
              <option value="owner">The record owner</option>
            </Select>
          </Field>
        )}
        {kind !== "UPDATE_CONTACT_STATUS" && (
          <Field label={kind === "SEND_EMAIL" ? "Email body" : "Task details"} name="body">
            <Textarea name="body" rows={3} />
          </Field>
        )}
        {kind === "UPDATE_CONTACT_STATUS" && (
          <Field label="Set contact status to" name="status">
            <Select name="status" defaultValue="CUSTOMER">
              {statusOptions}
            </Select>
          </Field>
        )}
      </fieldset>

      <div className="flex justify-end">
        <SubmitButton>Create automation</SubmitButton>
      </div>
    </ActionForm>
  );
}
