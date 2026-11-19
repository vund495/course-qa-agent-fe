// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it } from "vitest";

import StudentClassesLoading from "./(shell)/student/classes/loading";
import TeacherClassesLoading from "./(shell)/teacher/classes/loading";
import StudentTicketsLoading from "./(shell)/student/tickets/loading";
import TeacherTicketsLoading from "./(shell)/teacher/tickets/loading";
import StudentAttendanceLoading from "./(shell)/student/attendance/loading";
import TeacherAttendanceLoading from "./(shell)/teacher/attendance/loading";
import StudentHomeLoading from "./(shell)/student/home/loading";
import TeacherHomeLoading from "./(shell)/teacher/home/loading";
import StudentQuizzesLoading from "./(shell)/student/class/[id]/quizzes/loading";
import TeacherQuizzesLoading from "./(shell)/teacher/class/[id]/quizzes/loading";
import QuestionBankLoading from "./(shell)/teacher/class/[id]/question-bank/loading";
import MembersLoading from "./(shell)/student/class/[id]/members/loading";
import AdminClassesLoading from "./(shell)/admin/classes/loading";
import AdminUsersLoading from "./(shell)/admin/users/loading";
import AdminTicketQueueLoading from "./(shell)/admin/tickets/queue/loading";
import AdminHistoryLoading from "./(shell)/admin/history/loading";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("Loading Skeletons (AC-03)", () => {
  it("renders accessible loading skeleton for student classes", () => {
    act(() => {
      root.render(<StudentClassesLoading />);
    });
    expect(host.querySelector('[role="status"]')).toBeTruthy();
  });

  it("renders accessible loading skeleton for teacher classes", () => {
    act(() => {
      root.render(<TeacherClassesLoading />);
    });
    expect(host.querySelector('[role="status"]')).toBeTruthy();
  });

  it("renders accessible loading skeleton for student tickets", () => {
    act(() => {
      root.render(<StudentTicketsLoading />);
    });
    expect(host.querySelector('[role="status"]')).toBeTruthy();
  });

  it("renders accessible loading skeleton for teacher tickets", () => {
    act(() => {
      root.render(<TeacherTicketsLoading />);
    });
    expect(host.querySelector('[role="status"]')).toBeTruthy();
  });

  it("renders accessible loading skeleton for attendance", () => {
    act(() => {
      root.render(<StudentAttendanceLoading />);
    });
    expect(host.querySelector('[role="status"]')).toBeTruthy();

    act(() => {
      root.render(<TeacherAttendanceLoading />);
    });
    expect(host.querySelector('[role="status"]')).toBeTruthy();
  });

  it("renders accessible loading skeletons for home dashboards", () => {
    act(() => {
      root.render(<StudentHomeLoading />);
    });
    expect(host.querySelector('[role="status"]')).toBeTruthy();

    act(() => {
      root.render(<TeacherHomeLoading />);
    });
    expect(host.querySelector('[role="status"]')).toBeTruthy();
  });

  it("renders accessible loading skeletons for quizzes and question bank", () => {
    act(() => {
      root.render(<StudentQuizzesLoading />);
    });
    expect(host.querySelector('[role="status"]')).toBeTruthy();

    act(() => {
      root.render(<TeacherQuizzesLoading />);
    });
    expect(host.querySelector('[role="status"]')).toBeTruthy();

    act(() => {
      root.render(<QuestionBankLoading />);
    });
    expect(host.querySelector('[role="status"]')).toBeTruthy();
  });

  it("renders accessible loading skeleton for members", () => {
    act(() => {
      root.render(<MembersLoading />);
    });
    expect(host.querySelector('[role="status"]')).toBeTruthy();
  });

  it("renders accessible loading skeletons for admin lists", () => {
    act(() => {
      root.render(<AdminClassesLoading />);
    });
    expect(host.querySelector('[role="status"]')).toBeTruthy();

    act(() => {
      root.render(<AdminUsersLoading />);
    });
    expect(host.querySelector('[role="status"]')).toBeTruthy();

    act(() => {
      root.render(<AdminTicketQueueLoading />);
    });
    expect(host.querySelector('[role="status"]')).toBeTruthy();

    act(() => {
      root.render(<AdminHistoryLoading />);
    });
    expect(host.querySelector('[role="status"]')).toBeTruthy();
  });
});
