<breif>
For the first technical screening assignment, please share the below brief with the candidate.
*The candidate should complete the exercise during a monitored 60-minute session. They may use Claude Code, Codex, GitHub Copilot, or similar AI engineering tools. The objective is to assess whether they can independently create a functional full-stack product from a concise requirement.*
*Project* : Conversational Data Analyst
Build a full-stack application where a user can ask business questions in natural language and receive an answer derived from structured data.
*Examples:*
* Show monthly onboarding applications by customer segment.
* Which branches have the highest rejection rate?
* Compare retail and SME onboarding volumes.
* Show the top five customers by transaction value.
*Mandatory technology:*
* React
* Node.js
* TypeScript for both frontend and backend
* Any relational database, such as PostgreSQL, MySQL, SQLite, or Microsoft SQL Server
* Any charting library
* Any LLM provider or mocked AI implementation
*Functional requirements:*
The application should:
* Provide a chat-style user interface.
* Accept a natural-language question.
* Determine which dataset or database table is relevant.
* Generate or construct an appropriate query.
* Execute the query against the database.
Present the result as one or more of the following:
* Textual answer
* Table
* KPI card
* Bar chart
* Line chart
Allow the user to copy the answer, data, or visualisation output.
Handle invalid questions and technical errors gracefully.

The candidate should create their own sample banking data. At least two logically distinct datasets should be included, for example:
* Customer and branch information
* Onboarding applications
* Transactions
* Engineering expectations
The implementation should demonstrate:
* Strong TypeScript usage
* Clear frontend and backend separation
* Modular and maintainable code
* Input validation
* Safe database access
* Proper error handling
* Structured API responses
* Basic security awareness
* Sensible use of AI-generated code
The candidate should not allow unrestricted AI-generated SQL to execute without validation or control.

Submission
At the end of the session, the candidate must provide access to the repository containing:
* Complete source code
* Setup instructions
* .env.example
* Database schema or seed script
A brief README covering:
* Architecture
* Assumptions
* Completed functionality
* Known limitations
* How the solution would be productionised
* At least one meaningful automated test
* Clear commit history
* The candidate should also disclose which AI development tools were used and briefly explain which architectural and implementation decisions were made personally.
*Please ensure the candidate shares their screen throughout the exercise and creates the repository at the beginning of the session.*
</breif>

<tip>
let's do assessment considering it banking domain requirement
</tip>