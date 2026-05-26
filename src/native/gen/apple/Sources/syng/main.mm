#include "bindings/bindings.h"
#import <UIKit/UIKit.h>

// Minimum resizable scene dimensions for iPadOS and other windowed UIKit contexts.
// iPhone scenes are full-screen and do not use these size restrictions.
static const CGFloat MINIMUM_WINDOW_WIDTH = 560;
static const CGFloat MINIMUM_WINDOW_HEIGHT = 400;

static id _windowSizeObserver;

static void configureMinimumWindowSize(void) {
	_windowSizeObserver = [[NSNotificationCenter defaultCenter]
		addObserverForName:UISceneDidActivateNotification
		object:nil
		queue:[NSOperationQueue mainQueue]
		usingBlock:^(NSNotification *notification) {
			if ([notification.object isKindOfClass:[UIWindowScene class]]) {
				UIWindowScene *windowScene = (UIWindowScene *)notification.object;
				if (windowScene.traitCollection.userInterfaceIdiom == UIUserInterfaceIdiomPhone) {
					return;
				}
				windowScene.sizeRestrictions.minimumSize = CGSizeMake(MINIMUM_WINDOW_WIDTH, MINIMUM_WINDOW_HEIGHT);
			}
		}];
}

#pragma mark - iPadOS Menu Bar

static void openURL(NSString *urlString) {
	NSURL *url = [NSURL URLWithString:urlString];
	if (url) {
		[[UIApplication sharedApplication] openURL:url options:@{} completionHandler:nil];
	}
}

@interface UIApplication (SyngMenu)
@end

@implementation UIApplication (SyngMenu)

- (void)buildMenuWithBuilder:(id<UIMenuBuilder>)builder {
	[super buildMenuWithBuilder:builder];

	if (builder.system != UIMenuSystem.mainSystem) {
		return;
	}

	UIAction *githubAction = [UIAction
		actionWithTitle:@"Github"
		image:nil
		identifier:@"com.prestonwang.syng.github"
		handler:^(__kindof UIAction * _Nonnull action) {
			openURL(@"https://github.com/sotch-pr35mac/syng");
		}];

	UIAction *licenseAction = [UIAction
		actionWithTitle:@"License"
		image:nil
		identifier:@"com.prestonwang.syng.license"
		handler:^(__kindof UIAction * _Nonnull action) {
			openURL(@"https://github.com/sotch-pr35mac/syng/blob/master/LICENSE");
		}];

	UIAction *ccdictLicenseAction = [UIAction
		actionWithTitle:@"CC-CEDICT License"
		image:nil
		identifier:@"com.prestonwang.syng.cc-cedict"
		handler:^(__kindof UIAction * _Nonnull action) {
			openURL(@"https://github.com/sotch-pr35mac/syng/blob/master/LICENSE-CC-CEDICT");
		}];

	UIAction *bugAction = [UIAction
		actionWithTitle:@"Report Bug"
		image:nil
		identifier:@"com.prestonwang.syng.bug"
		handler:^(__kindof UIAction * _Nonnull action) {
			openURL(@"https://github.com/sotch-pr35mac/syng/issues");
		}];

	UIMenu *linksGroup = [UIMenu
		menuWithTitle:@""
		image:nil
		identifier:@"com.prestonwang.syng.help.links"
		options:UIMenuOptionsDisplayInline
		children:@[githubAction]];

	UIMenu *licensesGroup = [UIMenu
		menuWithTitle:@""
		image:nil
		identifier:@"com.prestonwang.syng.help.licenses"
		options:UIMenuOptionsDisplayInline
		children:@[licenseAction, ccdictLicenseAction]];

	UIMenu *bugGroup = [UIMenu
		menuWithTitle:@""
		image:nil
		identifier:@"com.prestonwang.syng.help.bug"
		options:UIMenuOptionsDisplayInline
		children:@[bugAction]];

	UIMenu *helpMenu = [UIMenu
		menuWithTitle:@"Help"
		image:nil
		identifier:@"com.prestonwang.syng.help"
		options:0
		children:@[linksGroup, licensesGroup, bugGroup]];

	[builder insertSiblingMenu:helpMenu afterMenuForIdentifier:UIMenuEdit];
}

@end

int main(int argc, char * argv[]) {
	configureMinimumWindowSize();
	ffi::start_app();
	return 0;
}
