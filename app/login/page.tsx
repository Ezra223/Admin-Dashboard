"use client";

import {
  CarOutlined,
  ClockCircleOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  MailOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Space, message, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../providers/AuthProvider";

const { Title, Text } = Typography;

const RATE_LIMIT_STORAGE_KEY = "miniway:login-rate-limit:v1";
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes

type RateLimitState = {
  failedAttempts: number[];
  lockUntil: number | null;
};

function getInitialRateLimitState(): RateLimitState {
  return { failedAttempts: [], lockUntil: null };
}

function normalizeRateLimitState(state: RateLimitState, now: number): RateLimitState {
  const filteredAttempts = state.failedAttempts.filter((ts) => now - ts <= WINDOW_MS);
  const lockUntil = state.lockUntil && state.lockUntil > now ? state.lockUntil : null;
  return { failedAttempts: filteredAttempts, lockUntil };
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>(
    getInitialRateLimitState()
  );
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const { signIn, user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      router.replace("/");
    }
  }, [authLoading, user, isAdmin, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as RateLimitState;
      const normalized = normalizeRateLimitState(parsed, Date.now());
      setRateLimitState(normalized);
      window.localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      const initial = getInitialRateLimitState();
      setRateLimitState(initial);
      window.localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(initial));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(rateLimitState));
  }, [rateLimitState]);

  useEffect(() => {
    if (!rateLimitState.lockUntil) {
      setRemainingSeconds(0);
      return;
    }

    const tick = () => {
      const diff = Math.max(0, Math.ceil((rateLimitState.lockUntil! - Date.now()) / 1000));
      setRemainingSeconds(diff);
      if (diff === 0) {
        setRateLimitState((prev) => normalizeRateLimitState({ ...prev, lockUntil: null }, Date.now()));
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [rateLimitState.lockUntil]);

  const isLocked = useMemo(() => {
    return !!rateLimitState.lockUntil && rateLimitState.lockUntil > Date.now();
  }, [rateLimitState.lockUntil]);

  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - rateLimitState.failedAttempts.length);

  const registerFailure = () => {
    const now = Date.now();
    setRateLimitState((prev) => {
      const normalized = normalizeRateLimitState(prev, now);
      const updatedAttempts = [...normalized.failedAttempts, now];
      const shouldLock = updatedAttempts.length >= MAX_ATTEMPTS;
      return {
        failedAttempts: shouldLock ? [] : updatedAttempts,
        lockUntil: shouldLock ? now + LOCKOUT_MS : normalized.lockUntil,
      };
    });
  };

  const resetRateLimit = () => {
    setRateLimitState(getInitialRateLimitState());
  };

  const onFinish = async (values: { email: string; password: string }) => {
    if (isLocked) {
      message.warning(`Too many attempts. Try again in ${remainingSeconds}s.`);
      return;
    }

    try {
      setLoading(true);
      await signIn(values.email, values.password);
      resetRateLimit();
      message.success("Welcome back! Redirecting to dashboard...");
      router.replace("/");
    } catch (error: any) {
      if (error.name === "AbortError" || error.message?.includes("aborted")) {
        return;
      }
      registerFailure();
      message.error(error.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    height: "56px",
    borderRadius: "14px",
    fontSize: "15px",
    border: "1px solid #dbe3ee",
    background: "#ffffff",
    boxShadow: "none",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        padding: "24px",
      }}
    >
      <Card
        bordered={false}
        styles={{ body: { padding: "40px 36px" } }}
        style={{
          width: "min(100%, 520px)",
          maxWidth: 520,
          borderRadius: "20px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 8px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              margin: "0 auto 16px",
              borderRadius: "16px",
              background: "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CarOutlined style={{ fontSize: "28px", color: "white" }} />
          </div>
          <Title level={2} style={{ margin: 0, fontWeight: 800, fontSize: "28px", color: "#0f172a" }}>
            Miniway Admin
          </Title>
          <Text style={{ color: "#64748b", fontSize: "14px", display: "block", marginTop: "8px" }}>
            Transportation Management System
          </Text>
        </div>

        <Space direction="vertical" size={12} style={{ width: "100%", marginBottom: 18 }}>
          <Alert
            type="info"
            showIcon
            icon={<SafetyCertificateOutlined />}
            message="Authorized Administrators Only"
            description="Use your assigned credentials to continue."
            style={{ borderRadius: "12px" }}
          />
          {isLocked && (
            <Alert
              type="error"
              showIcon
              icon={<ClockCircleOutlined />}
              message="Too Many Login Attempts"
              description={`Login is temporarily locked. Please wait ${remainingSeconds} seconds before trying again.`}
              style={{ borderRadius: "12px" }}
            />
          )}
          {!isLocked && rateLimitState.failedAttempts.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`Invalid login attempt. ${attemptsLeft} attempt(s) remaining before temporary lock.`}
              style={{ borderRadius: "12px" }}
            />
          )}
        </Space>

        <Form
          name="login"
          onFinish={onFinish}
          size="large"
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="email"
            label={<span style={{ fontWeight: 600, color: "#1e293b" }}>Email Address</span>}
            rules={[
              { required: true, message: "Please enter your email" },
              { type: "email", message: "Please enter a valid email" },
            ]}
            validateTrigger="onBlur"
          >
            <Input
              className="login-field"
              bordered={false}
              prefix={<MailOutlined style={{ color: "#94a3b8" }} />}
              placeholder="admin@miniway.com"
              autoComplete="email"
              autoFocus
              allowClear
              style={inputStyle}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={
              <span style={{ fontWeight: 600, color: "#1e293b" }}>
                Password
              </span>
            }
            rules={[{ required: true, message: "Please enter your password" }]}
            validateTrigger="onBlur"
          >
            <Input.Password
              className="login-field"
              bordered={false}
              prefix={<LockOutlined style={{ color: "#94a3b8" }} />}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={inputStyle}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: "16px", marginTop: "32px" }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={isLocked}
              style={{
                width: "100%",
                height: "52px",
                borderRadius: "12px",
                fontSize: "16px",
                fontWeight: 700,
                background: isLocked ? "#94a3b8" : "#0f172a",
                border: "none",
              }}
            >
              {loading ? "Signing in..." : isLocked ? `Try again in ${remainingSeconds}s` : "Sign In"}
            </Button>
          </Form.Item>
        </Form>

        <div
          style={{
            textAlign: "center",
            marginTop: "18px",
            paddingTop: "18px",
            borderTop: "1px solid #f0f0f0",
          }}
        >
          <Text style={{ color: "#64748b", fontSize: "13px" }}>Admin access only</Text>
          <br />
          <Text style={{ color: "#cbd5e1", fontSize: "12px", marginTop: "4px", display: "inline-block" }}>
            Contact system administrator for credentials
          </Text>
        </div>
      </Card>

      <style jsx global>{`
        .login-field.ant-input,
        .login-field.ant-input-affix-wrapper {
          border: 1px solid #dbe3ee !important;
          box-shadow: none !important;
          background: #ffffff !important;
        }

        .login-field.ant-input:hover,
        .login-field.ant-input:focus,
        .login-field.ant-input-affix-wrapper:hover,
        .login-field.ant-input-affix-wrapper:focus,
        .login-field.ant-input-affix-wrapper-focused {
          border: 1px solid #c9d6e4 !important;
          box-shadow: none !important;
          outline: none !important;
        }

        .login-field .ant-input {
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
        }
      `}</style>
    </div>
  );
}
