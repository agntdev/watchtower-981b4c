# WatchTower — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A private Telegram bot for tracking crypto price alerts (threshold and velocity-based) with quiet hours, cooldowns, and owner analytics. Users manage watchlists via buttons or text, receive on-demand prices, and optional morning summaries while the owner gets aggregated usage metrics.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Individual crypto investors
- Telegram power users
- Privacy-conscious traders

## Success criteria

- Users can create and manage watchlists with alerts
- Alerts fire reliably without spam during quiet hours
- Owner receives aggregated metrics in admin chat

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Initialize user profile with default settings
- **Add Bitcoin** (button, actor: user, callback: add_ticker:BTC) — Add BTC to watchlist with default settings
  - inputs: ticker symbol
  - outputs: watchlist update confirmation
- **View list** (button, actor: user, callback: view_watchlist) — Display current watchlist with management options
- **/price** (command, actor: user, command: /price) — Request current price of specified or all tracked tickers

## Flows

### Onboarding
_Trigger:_ /start

1. Display welcome message
2. Create default profile settings
3. Offer initial watchlist options

_Data touched:_ User

### Alert Creation
_Trigger:_ button:SET_THRESHOLD

1. Request alert direction
2. Capture target price
3. Confirm and store alert

_Data touched:_ Watchlist item, Alert event

### Morning Summary
_Trigger:_ scheduled_daily

1. Check quiet hours status
2. Compile price data
3. Send summary with alerts

_Data touched:_ User, Alert event

### Quiet Hour Handling
_Trigger:_ alert_fire_during_quiet

1. Queue alert
2. Defer delivery until quiet hours end
3. Bundle with other queued alerts

_Data touched:_ Alert event, User

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **User** _(retention: persistent)_ — Telegram user profile with preferences and watchlist
  - fields: telegram_id, quiet_hours, morning_summary_time, watchlist, cooldown_state
- **Watchlist item** _(retention: persistent)_ — Tracked cryptocurrency with alert rules
  - fields: ticker, display_name, last_known_price, threshold_alerts, velocity_alerts
- **Alert event** _(retention: persistent)_ — Fired alert with price change details
  - fields: user_id, ticker, alert_type, old_price, new_price, change_percent, timestamp
- **Owner metrics** _(retention: persistent)_ — Aggregated usage statistics
  - fields: total_users, alert_counts_by_ticker, alert_counts_by_type

## Integrations

- **Telegram** (required) — User interactions and admin metrics
- **Price API** (required) — Market data for price tracking
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Admin chat access to view aggregated metrics
- Configure default settings (cooldowns, quiet hours)

## Notifications

- Price threshold crossed
- Percent move alert
- Morning summary digest
- Deferred alerts after quiet hours

## Permissions & privacy

- All user data encrypted at rest
- No third-party data sharing
- Owner metrics aggregated and anonymized

## Edge cases

- Price API outages with retry logic
- Invalid ticker entries
- Alert spam prevention during market volatility

## Required tests

- Verify alert cooldown prevents repeated notifications
- Test quiet hour alert deferral and bundling
- Validate morning summary skips during quiet hours

## Assumptions

- Default USD currency remains acceptable
- Hourly percent window is sufficient for velocity alerts
- Price API reliability meets requirements
