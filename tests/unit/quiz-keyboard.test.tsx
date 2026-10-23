import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { useQuizKeyboard, type UseQuizKeyboardOptions } from "@/hooks/useQuizKeyboard";

function TestKeyboardConsumer(props: Partial<UseQuizKeyboardOptions>) {
  const defaults: UseQuizKeyboardOptions = {
    enabled: true,
    statementIds: ["stmt-1", "stmt-2", "stmt-3"],
    onToggleStatement: vi.fn(),
    onSetConfidence: vi.fn(),
    onSubmitAnswer: vi.fn(),
    onNextQuestion: vi.fn(),
    onToggleEvidence: vi.fn(),
    onToggleHelp: vi.fn(),
    isSubmitted: false,
    canSubmit: true,
    ...props,
  };

  useQuizKeyboard(defaults);

  return (
    <div>
      <input type="text" data-testid="test-input" />
      <span data-testid="keyboard-active">Active</span>
    </div>
  );
}

describe("Quiz Fluid Keyboard Navigation Hook", () => {
  it("selects statements A, B, and C with corresponding keys", () => {
    const onToggleStatement = vi.fn();
    render(
      <TestKeyboardConsumer
        statementIds={["id-a", "id-b", "id-c"]}
        onToggleStatement={onToggleStatement}
      />
    );

    fireEvent.keyDown(window, { key: "a" });
    expect(onToggleStatement).toHaveBeenCalledWith("id-a");

    fireEvent.keyDown(window, { key: "B" });
    expect(onToggleStatement).toHaveBeenCalledWith("id-b");

    fireEvent.keyDown(window, { key: "c" });
    expect(onToggleStatement).toHaveBeenCalledWith("id-c");
  });

  it("selects confidence levels 1 through 5 with number keys", () => {
    const onSetConfidence = vi.fn();
    render(<TestKeyboardConsumer onSetConfidence={onSetConfidence} />);

    fireEvent.keyDown(window, { key: "1" });
    expect(onSetConfidence).toHaveBeenCalledWith(1);

    fireEvent.keyDown(window, { key: "4" });
    expect(onSetConfidence).toHaveBeenCalledWith(4);

    fireEvent.keyDown(window, { key: "5" });
    expect(onSetConfidence).toHaveBeenCalledWith(5);
  });

  it("submits answer on Enter when canSubmit is true", () => {
    const onSubmitAnswer = vi.fn();
    render(
      <TestKeyboardConsumer canSubmit={true} onSubmitAnswer={onSubmitAnswer} />
    );

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onSubmitAnswer).toHaveBeenCalledTimes(1);
  });

  it("does not submit answer on Enter when canSubmit is false", () => {
    const onSubmitAnswer = vi.fn();
    render(
      <TestKeyboardConsumer canSubmit={false} onSubmitAnswer={onSubmitAnswer} />
    );

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onSubmitAnswer).not.toHaveBeenCalled();
  });

  it("advances to next question with N or Enter when isSubmitted is true", () => {
    const onNextQuestion = vi.fn();
    render(
      <TestKeyboardConsumer
        isSubmitted={true}
        onNextQuestion={onNextQuestion}
      />
    );

    fireEvent.keyDown(window, { key: "n" });
    expect(onNextQuestion).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onNextQuestion).toHaveBeenCalledTimes(2);
  });

  it("toggles evidence with E when isSubmitted is true", () => {
    const onToggleEvidence = vi.fn();
    render(
      <TestKeyboardConsumer
        isSubmitted={true}
        onToggleEvidence={onToggleEvidence}
      />
    );

    fireEvent.keyDown(window, { key: "e" });
    expect(onToggleEvidence).toHaveBeenCalledTimes(1);
  });

  it("toggles keyboard shortcut cheat sheet with ?", () => {
    const onToggleHelp = vi.fn();
    render(<TestKeyboardConsumer onToggleHelp={onToggleHelp} />);

    fireEvent.keyDown(window, { key: "?" });
    expect(onToggleHelp).toHaveBeenCalledTimes(1);
  });

  it("ignores keypresses when user is actively focused on an input", () => {
    const onToggleStatement = vi.fn();
    const { getByTestId } = render(
      <TestKeyboardConsumer onToggleStatement={onToggleStatement} />
    );

    const input = getByTestId("test-input");
    fireEvent.keyDown(input, { key: "a" });
    expect(onToggleStatement).not.toHaveBeenCalled();
  });
});
