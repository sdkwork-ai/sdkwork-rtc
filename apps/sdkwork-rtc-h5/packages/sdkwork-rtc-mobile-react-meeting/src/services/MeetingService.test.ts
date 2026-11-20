import { describe, expect, it } from "vitest";

import { MeetingCapabilityUnavailableError, MeetingService } from "./MeetingService";

describe("meeting service fail-closed contract", () => {
  it("rejects every operation until the owner SDK is composed", async () => {
    const request = {
      attendeeIds: ["user-id"],
      endTime: "2026-07-29T10:00:00Z",
      startTime: "2026-07-29T09:00:00Z",
      title: "test",
    };
    for (const operation of [
      MeetingService.getMeetings(),
      MeetingService.getMeetingDetail("meeting-id"),
      MeetingService.createMeeting(request),
      MeetingService.updateMeeting({ id: "meeting-id", title: "updated" }),
      MeetingService.cancelMeeting("meeting-id"),
    ]) {
      await expect(operation).rejects.toThrowError(MeetingCapabilityUnavailableError);
    }
  });
});
