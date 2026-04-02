const { MAPPED_COLUMNS } = require("./wordbeeMappingConfig");

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeWordbeeLabelValue(value, toStringValue) {
  if (value === null || value === undefined) return "";
  const parsed = parseMaybeJson(value);
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    Number(parsed.xp) === 0 &&
    Number(parsed.cnt) === 0
  ) {
    return "";
  }
  return toStringValue(value);
}

function pickFirstWordbeeValue(values, toStringValue) {
  for (const value of values) {
    const normalized = normalizeWordbeeLabelValue(value, toStringValue);
    if (normalized) return normalized;
  }
  return "";
}

function translateStatusToDutch(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalized = raw.toLowerCase();
  if (normalized === "in progress" || normalized === "in-progress") return "In uitvoering";
  if (normalized === "results approved" || normalized === "result approved" || normalized === "approved") {
    return "Resultaten goedgekeurd";
  }
  if (normalized === "request" || normalized === "proposal" || normalized === "waiting") return "Verzoek";
  if (normalized === "work done" || normalized === "done" || normalized === "completed") return "Werk klaar";
  if (normalized === "cancelled" || normalized === "canceled") return "Geannuleerd";
  return raw;
}

function createMappedRow({ project, company, person, jobs, order, resource, pickFirstValue, toStringValue, formatDateTimeNl }) {
  const proposalIso = toStringValue(order?.dtproposal);
  const acceptedIso = toStringValue(order?.dtaccepted);
  const inProgressIso = jobs?.firstInProgressIso || project?.dtinprogress || "";
  const doneIso = toStringValue(order?.dtcompleted || project?.dtcompletion);
  const proposalInitialIso = jobs?.firstProposalIso || proposalIso;
  const doneInitialIso = jobs?.firstDoneIso || doneIso;
  const archivedIso = toStringValue(order?.dtclosed || project?.dtarchival);
  const receivedIso = toStringValue(order?.dtreceived || project?.dtreceived);
  const deadlineIso = toStringValue(order?.deadline || project?.deadline);
  const createdIso = toStringValue(order?.created || project?.created || project?.dtreceived);
  const newLabelValue = pickFirstWordbeeValue(
    [order?.lblord613, project?.lblpro610, project?.lblpro608, project?.lblpro604, project?.lblpro603, project?.lblpro],
    toStringValue
  );
  const resourceSegments = Number(resource?.segments);
  const hasResourceSegments = Number.isFinite(resourceSegments);
  const translatedWords = hasResourceSegments ? resourceSegments : "";
  const proposalOtherDeadline = pickFirstWordbeeValue([order?.cford1, order?.lblord613, order?.lblord], toStringValue);
  const rbtvNumber = pickFirstWordbeeValue(
    [order?.cford2, person?.lblper607, person?.lblper616, person?.lblper617, person?.personcode],
    toStringValue
  );
  const statusRaw = pickFirstValue(order?.statust, order?.status, project?.statust, project?.status);
  const row = {
    "Kenmerk": toStringValue(project?.reference),
    "Aanvraagnummer": toStringValue(project?.id),
    "Status": translateStatusToDutch(statusRaw),
    "Comments": pickFirstValue(order?.comments, project?.comments),
    "Clientnaam": pickFirstValue(project?.client, company?.name),
    "Persoonsnaam": pickFirstValue(
      [toStringValue(person?.firstname), toStringValue(person?.lastname)].filter(Boolean).join(" "),
      person?.contactname
    ),
    "Land": pickFirstValue(company?.countryt, company?.country),
    "Stad": toStringValue(company?.city),
    "Postcode": pickFirstValue(company?.zip, company?.InvZip),
    "Manager naam": pickFirstValue(project?.managernm, project?.pmanagernm),
    "Brontaal": pickFirstValue(project?.srct, project?.src),
    "Datum van ontvangst": formatDateTimeNl(receivedIso),
    "Deadline": formatDateTimeNl(deadlineIso),
    "Aanmaakdatum": formatDateTimeNl(createdIso),
    "Datum van voorstel": formatDateTimeNl(proposalIso),
    "Aanvaarde datum": formatDateTimeNl(acceptedIso),
    "Voltooiingsdatum": formatDateTimeNl(doneIso),
    "Gesloten datum": formatDateTimeNl(archivedIso),
    "Proposal (Initial) Date": formatDateTimeNl(proposalInitialIso),
    "Done (Initial) Date": formatDateTimeNl(doneInitialIso),
    "In Progress (Initial) Date": formatDateTimeNl(inProgressIso),
    "Interne opmerkingen": pickFirstValue(project?.comments, project?.instructions),
    "Nummer Rbtv": rbtvNumber,
    "New label": newLabelValue,
    "Receptie datum ISO": receivedIso,
    "Deadline van ISO": deadlineIso,
    "Aanmaakdatum ISO": createdIso,
    "Voorstel datum ISO": proposalIso,
    "Aanvaarde datum ISO": acceptedIso,
    "Gedaan datum ISO": doneIso,
    "Gesloten datum ISO": archivedIso,
    "Aantal vertaalde woorden": translatedWords,
    "Voorstel ander deadline": proposalOtherDeadline,
  };
  return MAPPED_COLUMNS.reduce((acc, key) => {
    acc[key] = row[key] ?? "";
    return acc;
  }, {});
}

module.exports = {
  createMappedRow,
};
