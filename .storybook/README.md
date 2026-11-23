# Syng desktop design catalog

Run `npm run storybook` and open the loopback address shown by Storybook. The catalog uses the app's actual theme CSS and Sy components, with local fixture data. `npm run build:storybook` makes a static build in `storybook-static/` for local inspection. Neither command launches Tauri or writes app preferences.

The Foundation stories show the current five surface roles, color tokens, elevation tokens, and typography roles. The typography story compares desktop and phone variants and names the current app usage behind each role. Role Contracts show the material roles in a composed layout and map the current material, interaction, and spatial treatment of each cataloged Sy element. Element stories render the live desktop components. Hover, keyboard focus, and interactive states can be exercised in each story. The Coverage and Gaps story records what is still missing.

Stories under Adopted references preserve the earlier interaction studies for comparison. The Collapsible List, Dropdown, Toast, Popover, plain Modal, and grouped Radio Choices directions have been adopted by the live Sy components; compare their Element stories to see current behavior.

The Walkthrough stories render the real Settings guide picker and contextual help entry. Guide launching is intercepted in the catalog so these examples do not start tours or write preferences. The live overlay and spotlight remain listed as gaps until they have an isolated fixture.

Future pattern requirements map proposed Reader audio and feeds, sentence analysis, Study history and configuration, and learning stats to current components and shared design needs. They are planning references, not implemented features or approved visual treatments.

The Surface texture story compares solid canvas material with the selected fixed SVG grain tile at 15% overlay blend. Its colors and texture token come from the live app theme. Change the browser or system appearance to inspect light and dark rendering; Increase Contrast and forced colors keep a solid canvas.

The preview follows the browser/system light or dark scheme. For accurate appearance comparisons, change the browser color scheme and inspect the installed app's Increase Contrast setting separately. The catalog is a development aid, not an app screen or a replacement for native visual review.

New live-component stories belong in `stories/desktop/` and should render the source component with local fixtures. Keep proposed variants clearly labeled and separate from the live catalog. Mobile stories should be added as a separate later slice.
