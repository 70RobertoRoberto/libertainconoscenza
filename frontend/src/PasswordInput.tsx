// Reusable password input with show/hide eye toggle.
// Uses only React Native primitives so it works on iOS, Android and Expo web.
import React, { useState } from "react";
import { View, TextInput, Pressable, Text, StyleSheet, TextInputProps, ViewStyle } from "react-native";
import { colors, spacing, radius } from "./theme";

type Props = Omit<TextInputProps, "secureTextEntry" | "style"> & {
  containerStyle?: ViewStyle;
  inputStyle?: TextInputProps["style"];
};

export function PasswordInput({ containerStyle, inputStyle, testID, ...rest }: Props) {
  const [show, setShow] = useState(false);
  return (
    <View style={[styles.wrap, containerStyle]}>
      <TextInput
        {...rest}
        testID={testID}
        secureTextEntry={!show}
        style={[styles.input, inputStyle]}
        autoCapitalize="none"
        autoCorrect={false}
        // On Android, secureTextEntry disables autoComplete which breaks visibility toggle.
        // Setting textContentType to none plus disabling autoComplete keeps it consistent.
        textContentType="password"
      />
      <Pressable
        testID={testID ? `${testID}-toggle` : undefined}
        onPress={() => setShow((s) => !s)}
        hitSlop={10}
        style={styles.eyeBtn}
        accessibilityLabel={show ? "Nascondi password" : "Mostra password"}
      >
        <Text style={styles.eyeIcon} allowFontScaling={false}>{show ? "🙈" : "👁"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    justifyContent: "center",
  },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingRight: 48, // leave room for the eye
    paddingVertical: 12,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
  },
  eyeBtn: {
    position: "absolute",
    right: 4,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  eyeIcon: {
    fontSize: 20,
  },
});
