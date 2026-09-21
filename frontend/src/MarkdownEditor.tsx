import React, { useCallback, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, NativeSyntheticEvent, TextInputSelectionChangeEventData } from "react-native";
import { colors, spacing, radius } from "./theme";

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  testID?: string;
  minHeight?: number;
};

/**
 * Lightweight markdown editor with a toolbar that inserts:
 *   **bold**, *italic*, ## Capitolo, ### Sottocapitolo, - punto elenco, > citazione
 * The value is plain markdown text; rendering is done via <Markdown> in the article detail.
 */
export default function MarkdownEditor({ value, onChangeText, placeholder, testID, minHeight = 200 }: Props) {
  const inputRef = useRef<TextInput>(null);
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

  const handleSelectionChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    setSelection(e.nativeEvent.selection);
  };

  const wrap = useCallback(
    (prefix: string, suffix?: string) => {
      const s = suffix ?? prefix;
      const { start, end } = selection;
      const before = value.slice(0, start);
      const middle = value.slice(start, end) || "testo";
      const after = value.slice(end);
      const next = `${before}${prefix}${middle}${s}${after}`;
      onChangeText(next);
      // Move cursor to just after inserted middle
      const newCursor = start + prefix.length + middle.length;
      setTimeout(() => {
        inputRef.current?.setNativeProps({ selection: { start: newCursor, end: newCursor } });
      }, 0);
    },
    [selection, value, onChangeText]
  );

  const insertLinePrefix = useCallback(
    (linePrefix: string, placeholder = "titolo") => {
      const { start, end } = selection;
      // Find beginning of current line
      const before = value.slice(0, start);
      const lastNL = before.lastIndexOf("\n");
      const lineStart = lastNL + 1;
      const currentLine = value.slice(lineStart, end || start);
      const rest = value.slice(end || start);
      const beforeLine = value.slice(0, lineStart);
      // If line is empty, insert placeholder to make heading visible
      const lineContent = currentLine.trim() ? currentLine : placeholder;
      const newLine = `${linePrefix}${lineContent}`;
      const next = `${beforeLine}${newLine}${rest}`;
      onChangeText(next);
      const newCursor = beforeLine.length + newLine.length;
      setTimeout(() => {
        inputRef.current?.setNativeProps({ selection: { start: newCursor, end: newCursor } });
      }, 0);
    },
    [selection, value, onChangeText]
  );

  const btns: { label: string; onPress: () => void; hint?: string }[] = [
    { label: "B", onPress: () => wrap("**"), hint: "Grassetto" },
    { label: "I", onPress: () => wrap("*"), hint: "Corsivo" },
    { label: "H1", onPress: () => insertLinePrefix("## ", "Capitolo"), hint: "Capitolo" },
    { label: "H2", onPress: () => insertLinePrefix("### ", "Sottocapitolo"), hint: "Sottocapitolo" },
    { label: "•", onPress: () => insertLinePrefix("- ", "voce elenco"), hint: "Elenco" },
    { label: "\u201C\u201D", onPress: () => insertLinePrefix("> ", "citazione"), hint: "Citazione" },
  ];

  return (
    <View>
      <View style={styles.toolbar}>
        {btns.map((b) => (
          <Pressable
            key={b.label}
            onPress={b.onPress}
            style={styles.btn}
            testID={`md-${b.hint?.toLowerCase() || b.label}`}
          >
            <Text style={styles.btnLabel}>{b.label}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        onSelectionChange={handleSelectionChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline
        style={[styles.input, { minHeight, textAlignVertical: "top" }]}
      />
      <Text style={styles.hint}>
        Usa **grassetto**, *corsivo*, ## Capitolo, ### Sottocapitolo, - elenco, {'>'} citazione.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.xs,
    flexWrap: "wrap",
  },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
    minWidth: 42,
    alignItems: "center",
  },
  btnLabel: {
    color: colors.onSurface,
    fontWeight: "700",
    fontSize: 14,
  },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
    lineHeight: 22,
  },
  hint: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 6,
    fontStyle: "italic",
  },
});
