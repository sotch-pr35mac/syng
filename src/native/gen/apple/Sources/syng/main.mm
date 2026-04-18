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

int main(int argc, char * argv[]) {
	configureMinimumWindowSize();
	ffi::start_app();
	return 0;
}
