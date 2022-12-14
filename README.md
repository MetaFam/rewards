# MetaGame Rewards

## Two-Tiered Coordinape

This script calculates a [Coordinape](//coordinape.com) distribution based on a top-level circle that determines how SEEDs are allocated to participation circles.

### Installation

1. Run `yarn` to install dependencies.
2. Visit [app.coordinape.com/developers](//app.coordinape.com/developers) and authenticate to get an authorization token. It will appear as the "Authorization" header in the "Request Headers" near the top of the screen.
3. Copy `env.sample` to `.env`.
4. Put the authorization header in `.env` as `AUTH_TOKEN`.
5. Put the name of the top circle which distributes to the subcircles in the `.env` as `TOP_CIRCLE` or on the command line as `-t` or `--top`.
6. If you run the program without an epoch id, it will list the epochs & their ids.
7. Specify the epoch id as `-e` or `--epoch`.
